"""US07 — Desactivación por inactividad (issue #9)."""

from datetime import timedelta

import pytest

import inactividad
from conftest import CONTRASENA_VALIDA, crear_usuario, registrar_y_verificar
from db.database import SessionLocal
from db.models import Usuario


def mover_ultimo_acceso(email, dias_atras):
    with SessionLocal() as db:
        usuario = db.query(Usuario).filter(Usuario.email == email).one()
        usuario.ultimo_acceso = inactividad.ahora() - timedelta(days=dias_atras)
        db.commit()


def estado(email):
    with SessionLocal() as db:
        u = db.query(Usuario).filter(Usuario.email == email).one()
        return u.activo, u.desactivado_por_inactividad, u.ultimo_acceso


def login(cliente, email):
    return cliente.post("/auth/login", json={"email": email, "contrasena": CONTRASENA_VALIDA})


@pytest.fixture
def admin(cliente):
    return crear_usuario(cliente, email="admin@eafit.edu.co", nombre="Admin", rol="administrador")


def test_iniciar_sesion_registra_el_ultimo_acceso(cliente):
    registrar_y_verificar(cliente, email="ana@eafit.edu.co")
    assert estado("ana@eafit.edu.co")[2] is None
    assert login(cliente, "ana@eafit.edu.co").status_code == 200
    assert estado("ana@eafit.edu.co")[2] is not None


def test_cuenta_sin_uso_por_mas_del_plazo_se_desactiva_al_intentar_entrar(cliente):
    registrar_y_verificar(cliente, email="ana@eafit.edu.co")
    mover_ultimo_acceso("ana@eafit.edu.co", inactividad.DIAS_INACTIVIDAD + 1)

    respuesta = login(cliente, "ana@eafit.edu.co")
    assert respuesta.status_code == 403
    assert "desactivó por inactividad" in respuesta.json()["detail"]
    assert estado("ana@eafit.edu.co")[:2] == (False, True)
    # Sigue bloqueada en los intentos siguientes.
    assert login(cliente, "ana@eafit.edu.co").status_code == 403


def test_cuenta_dentro_del_plazo_sigue_entrando(cliente):
    registrar_y_verificar(cliente, email="ana@eafit.edu.co")
    mover_ultimo_acceso("ana@eafit.edu.co", inactividad.DIAS_INACTIVIDAD - 1)
    assert login(cliente, "ana@eafit.edu.co").status_code == 200
    assert estado("ana@eafit.edu.co")[0] is True


def test_contrasena_incorrecta_no_revela_ni_cambia_el_estado(cliente):
    registrar_y_verificar(cliente, email="ana@eafit.edu.co")
    mover_ultimo_acceso("ana@eafit.edu.co", inactividad.DIAS_INACTIVIDAD + 1)
    respuesta = cliente.post("/auth/login", json={"email": "ana@eafit.edu.co", "contrasena": "OtraClave12345"})
    assert respuesta.status_code == 401
    assert estado("ana@eafit.edu.co")[0] is True


def test_los_administradores_nunca_se_desactivan_por_inactividad(cliente, admin):
    mover_ultimo_acceso("admin@eafit.edu.co", inactividad.DIAS_INACTIVIDAD * 3)
    assert login(cliente, "admin@eafit.edu.co").status_code == 200


def test_usar_la_app_cuenta_como_actividad(cliente):
    cabeceras = crear_usuario(cliente, email="ana@eafit.edu.co")
    mover_ultimo_acceso("ana@eafit.edu.co", 30)
    assert cliente.get("/auth/me", headers=cabeceras).status_code == 200
    ultimo = estado("ana@eafit.edu.co")[2]
    assert inactividad.ahora() - ultimo < timedelta(minutes=1)


def test_el_administrador_desactiva_todas_las_cuentas_inactivas(cliente, admin):
    for email in ("vieja1@eafit.edu.co", "vieja2@eafit.edu.co", "reciente@eafit.edu.co"):
        registrar_y_verificar(cliente, email=email, nombre=email.split("@")[0])
    mover_ultimo_acceso("vieja1@eafit.edu.co", inactividad.DIAS_INACTIVIDAD + 10)
    mover_ultimo_acceso("vieja2@eafit.edu.co", inactividad.DIAS_INACTIVIDAD + 400)
    mover_ultimo_acceso("reciente@eafit.edu.co", 5)
    mover_ultimo_acceso("admin@eafit.edu.co", inactividad.DIAS_INACTIVIDAD + 50)

    respuesta = cliente.post("/admin/usuarios/desactivar-inactivos", headers=admin)
    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["dias_inactividad"] == inactividad.DIAS_INACTIVIDAD
    assert datos["desactivados"] == 2
    assert sorted(datos["correos"]) == ["vieja1@eafit.edu.co", "vieja2@eafit.edu.co"]
    assert estado("reciente@eafit.edu.co")[0] is True

    # El listado de administración muestra el motivo y el último acceso.
    usuarios = {u["email"]: u for u in cliente.get("/admin/usuarios", headers=admin).json()}
    assert usuarios["vieja1@eafit.edu.co"]["activo"] is False
    assert usuarios["vieja1@eafit.edu.co"]["desactivado_por_inactividad"] is True
    assert usuarios["reciente@eafit.edu.co"]["ultimo_acceso"] is not None


def test_solo_un_administrador_puede_barrer_inactivos(cliente):
    estudiante = crear_usuario(cliente, email="ana@eafit.edu.co")
    assert cliente.post("/admin/usuarios/desactivar-inactivos", headers=estudiante).status_code == 403


def test_al_reactivar_la_cuenta_vuelve_a_entrar_y_el_plazo_reinicia(cliente, admin):
    registrar_y_verificar(cliente, email="ana@eafit.edu.co")
    mover_ultimo_acceso("ana@eafit.edu.co", inactividad.DIAS_INACTIVIDAD + 1)
    assert login(cliente, "ana@eafit.edu.co").status_code == 403

    ana = next(u for u in cliente.get("/admin/usuarios", headers=admin).json() if u["email"] == "ana@eafit.edu.co")
    respuesta = cliente.patch(f"/admin/usuarios/{ana['id']}", json={"activo": True}, headers=admin)
    assert respuesta.status_code == 200
    assert respuesta.json()["desactivado_por_inactividad"] is False

    assert login(cliente, "ana@eafit.edu.co").status_code == 200


def test_desactivada_por_un_admin_muestra_el_mensaje_general(cliente, admin):
    registrar_y_verificar(cliente, email="ana@eafit.edu.co")
    ana = next(u for u in cliente.get("/admin/usuarios", headers=admin).json() if u["email"] == "ana@eafit.edu.co")
    cliente.patch(f"/admin/usuarios/{ana['id']}", json={"activo": False}, headers=admin)
    respuesta = login(cliente, "ana@eafit.edu.co")
    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == "Tu cuenta fue desactivada. Contacta a un administrador."


def test_un_token_vigente_de_una_cuenta_desactivada_por_inactividad_deja_de_servir(cliente, admin):
    cabeceras = crear_usuario(cliente, email="ana@eafit.edu.co")
    mover_ultimo_acceso("ana@eafit.edu.co", inactividad.DIAS_INACTIVIDAD + 1)
    cliente.post("/admin/usuarios/desactivar-inactivos", headers=admin)
    respuesta = cliente.get("/auth/me", headers=cabeceras)
    assert respuesta.status_code == 403
    assert "desactivó por inactividad" in respuesta.json()["detail"]
