"""US01 — Registro con correo institucional (issue #2)."""

import pytest

from conftest import CONTRASENA_VALIDA, registrar


def test_registro_con_correo_institucional_crea_la_cuenta(cliente):
    respuesta = registrar(cliente, email="ana.perez@eafit.edu.co")
    assert respuesta.status_code == 201
    assert respuesta.json()["email"] == "ana.perez@eafit.edu.co"
    assert respuesta.json()["access_token"]


def test_se_aceptan_subdominios_institucionales(cliente):
    assert registrar(cliente, email="ana@est.eafit.edu.co").status_code == 201


@pytest.mark.parametrize(
    "email",
    [
        "ana@gmail.com",
        "ana@hotmail.com",
        "ana@eafit.edu.co.hacker.com",  # el dominio debe TERMINAR en el institucional
        "ana@noeafit.edu.co",           # ni ser un dominio que solo lo contiene
    ],
)
def test_registro_con_correo_no_institucional_se_rechaza(cliente, email):
    respuesta = registrar(cliente, email=email)
    assert respuesta.status_code == 422
    assert "Usa tu correo institucional (@eafit.edu.co)." in respuesta.json()["detail"]


def test_no_se_puede_registrar_dos_veces_el_mismo_correo_aunque_cambien_mayusculas(cliente):
    assert registrar(cliente, email="ana@eafit.edu.co").status_code == 201
    respuesta = registrar(cliente, email="ANA@eafit.edu.co")
    assert respuesta.status_code == 409


def test_contrasena_debil_se_rechaza_con_mensaje_claro(cliente):
    respuesta = registrar(cliente, contrasena="corta")
    assert respuesta.status_code == 422


def test_el_usuario_registrado_puede_iniciar_sesion(cliente):
    registrar(cliente, email="ana@eafit.edu.co")
    respuesta = cliente.post("/auth/login", json={"email": "ana@eafit.edu.co", "contrasena": CONTRASENA_VALIDA})
    assert respuesta.status_code == 200


def test_no_se_puede_cambiar_el_correo_por_uno_personal(cliente, cabeceras):
    respuesta = cliente.patch("/auth/perfil", json={"email": "ana@gmail.com"}, headers=cabeceras)
    assert respuesta.status_code == 422
    assert cliente.get("/auth/me", headers=cabeceras).json()["email"] == "ana.perez@eafit.edu.co"


def test_si_se_puede_cambiar_por_otro_correo_institucional(cliente, cabeceras):
    respuesta = cliente.patch("/auth/perfil", json={"email": "ana.p@eafit.edu.co"}, headers=cabeceras)
    assert respuesta.status_code == 200
    assert respuesta.json()["email"] == "ana.p@eafit.edu.co"


def test_dominios_permitidos_es_publico(cliente):
    respuesta = cliente.get("/auth/dominios-permitidos")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"dominios": ["eafit.edu.co"]}


def test_cuenta_antigua_con_correo_personal_sigue_funcionando(cliente):
    # Cuentas creadas antes de US01: pueden entrar y editar su nombre sin
    # que se les exija cambiar el correo (el front siempre manda el email).
    from auth import hashear_contrasena
    from db.database import SessionLocal
    from db.models import Usuario

    with SessionLocal() as db:
        db.add(Usuario(nombre="Antiguo", email="antiguo@gmail.com", contrasena_hash=hashear_contrasena(CONTRASENA_VALIDA)))
        db.commit()

    login = cliente.post("/auth/login", json={"email": "antiguo@gmail.com", "contrasena": CONTRASENA_VALIDA})
    assert login.status_code == 200
    cabeceras = {"Authorization": f"Bearer {login.json()['access_token']}"}
    respuesta = cliente.patch("/auth/perfil", json={"nombre": "Nuevo nombre", "email": "antiguo@gmail.com"}, headers=cabeceras)
    assert respuesta.status_code == 200
    assert respuesta.json()["nombre"] == "Nuevo nombre"
