"""US30 — registro de actividad y consulta de frecuencia de uso e interacciones
(solo administrador)."""

import pytest
from sqlalchemy import text

from conftest import crear_usuario


@pytest.fixture
def admin(cliente):
    return crear_usuario(cliente, email="admin@eafit.edu.co", nombre="Admin", rol="administrador")


@pytest.fixture
def estudiante(cliente):
    return crear_usuario(cliente, email="esteban@eafit.edu.co", nombre="Esteban")


def uso(cliente, admin, dias=30):
    r = cliente.get(f"/metricas/uso?dias={dias}", headers=admin)
    assert r.status_code == 200, r.text
    return r.json()


def total(u, tipo):
    return next(t["total"] for t in u["por_tipo"] if t["tipo"] == tipo)


def id_de(cliente, cabeceras):
    return cliente.get("/auth/me", headers=cabeceras).json()["usuario_id"]


def eventos(usuario_id, tipo):
    from db.database import SessionLocal
    with SessionLocal() as db:
        return db.execute(
            text("SELECT count(*) FROM eventos_actividad WHERE usuario_id = :u AND tipo = :t"),
            {"u": usuario_id, "t": tipo},
        ).scalar()


# --- el sistema registra la actividad y las interacciones ---

def test_iniciar_sesion_y_las_interacciones_quedan_registradas(cliente, cabeceras, estudiante):
    uid = id_de(cliente, estudiante)
    assert eventos(uid, "inicio_sesion") == 1

    curso = cliente.post("/cursos", json={"nombre": "Circuitos"}, headers=cabeceras).json()
    ejercicio = cliente.post(f"/cursos/{curso['id']}/ejercicios", json={"titulo": "Ohm"}, headers=cabeceras).json()
    cliente.post("/cursos/inscripciones", json={"codigo": curso["codigo_acceso"]}, headers=estudiante)
    cliente.post(f"/ejercicios/{ejercicio['id']}/solucion", data={"texto": "I = V/R"}, headers=estudiante)
    for nombre in ("A", "B"):
        cliente.post(
            "/sesiones",
            json={"nombre": nombre, "netlist": {"componentes": [], "conexiones": []}, "instrucciones": []},
            headers=estudiante,
        )
    assert eventos(uid, "inscripcion") == 1
    assert eventos(uid, "entrega") == 1
    assert eventos(uid, "circuito") == 2
    pid = id_de(cliente, cabeceras)
    assert eventos(pid, "curso_creado") == 1
    assert eventos(pid, "ejercicio_creado") == 1


def test_el_uso_normal_registra_actividad_como_mucho_una_vez_por_hora(cliente, estudiante):
    from db.database import SessionLocal
    uid = id_de(cliente, estudiante)
    cliente.get("/auth/me", headers=estudiante)
    assert eventos(uid, "actividad") == 0  # acaba de iniciar sesión: ya cuenta
    with SessionLocal() as db:
        db.execute(text("UPDATE usuarios SET ultimo_acceso = now() - interval '2 hours' WHERE id = :u"), {"u": uid})
        db.commit()
    cliente.get("/auth/me", headers=estudiante)
    cliente.get("/auth/me", headers=estudiante)
    assert eventos(uid, "actividad") == 1


def test_un_fallo_al_registrar_no_rompe_nada():
    from actividad import registrar_evento
    registrar_evento("no-es-un-uuid", "chat")  # no lanza
    registrar_evento("00000000-0000-0000-0000-000000000000", "tipo_inexistente")  # no lanza


# --- el administrador consulta las métricas ---

def test_el_administrador_ve_la_frecuencia_de_uso_y_las_interacciones(cliente, admin, estudiante):
    antes = uso(cliente, admin)
    cliente.post(
        "/sesiones",
        json={"nombre": "A", "netlist": {"componentes": [], "conexiones": []}, "instrucciones": []},
        headers=estudiante,
    )
    despues = uso(cliente, admin)
    assert despues["periodo"]["dias"] == 30
    assert len(despues["serie_diaria"]) == 30
    assert len(despues["por_hora"]) == 24
    assert despues["resumen"]["interacciones"] == antes["resumen"]["interacciones"] + 1
    assert total(despues, "circuito") == total(antes, "circuito") + 1
    assert despues["resumen"]["usuarios_activos"] >= 2  # admin y estudiante iniciaron sesión
    assert despues["serie_diaria"][-1]["interacciones"] >= 1  # hoy
    etiquetas = {t["tipo"]: t["etiqueta"] for t in despues["por_tipo"]}
    assert etiquetas["chat"] == "Preguntas al asistente"
    # Iniciar sesión es presencia, no una interacción.
    assert next(t for t in despues["por_tipo"] if t["tipo"] == "inicio_sesion")["es_interaccion"] is False


def test_periodos_validos_y_rechazo_de_invalidos(cliente, admin):
    assert len(uso(cliente, admin, 7)["serie_diaria"]) == 7
    assert len(uso(cliente, admin, 90)["serie_diaria"]) == 90
    for dias in (3, 400):
        assert cliente.get(f"/metricas/uso?dias={dias}", headers=admin).status_code == 422


def test_uso_por_usuario_con_filtros_y_detalle(cliente, admin, estudiante, cabeceras):
    uid = id_de(cliente, estudiante)
    for nombre in ("A", "B", "C"):
        cliente.post(
            "/sesiones",
            json={"nombre": nombre, "netlist": {"componentes": [], "conexiones": []}, "instrucciones": []},
            headers=estudiante,
        )
    lista = cliente.get("/metricas/uso/usuarios?buscar=esteban", headers=admin).json()
    assert lista["total"] == 1
    fila = lista["usuarios"][0]
    assert fila["interacciones"] == 3 and fila["inicios_sesion"] == 1 and fila["dias_activos"] == 1
    assert fila["frecuencia"] == round(1 / 30 * 100)

    solo_profes = cliente.get("/metricas/uso/usuarios?rol=profesor", headers=admin).json()["usuarios"]
    assert solo_profes and all(u["rol"] == "profesor" for u in solo_profes)
    assert len(cliente.get("/metricas/uso/usuarios?limite=1", headers=admin).json()["usuarios"]) == 1
    assert cliente.get("/metricas/uso/usuarios?buscar=zzzzzz", headers=admin).json()["usuarios"] == []

    detalle = cliente.get(f"/metricas/uso/usuarios/{uid}", headers=admin).json()
    assert detalle["usuario"]["nombre"] == "Esteban"
    assert sum(p["interacciones"] for p in detalle["serie_diaria"]) == 3
    assert len(detalle["recientes"]) <= 15
    assert cliente.get("/metricas/uso/usuarios/00000000-0000-0000-0000-000000000000", headers=admin).status_code == 404


def test_parametros_invalidos_en_la_lista(cliente, admin):
    assert cliente.get("/metricas/uso/usuarios?orden=otro", headers=admin).status_code == 422
    assert cliente.get("/metricas/uso/usuarios?rol=otro", headers=admin).status_code == 422


def test_solo_el_administrador_puede_consultar(cliente, cabeceras, estudiante):
    uid = id_de(cliente, estudiante)
    for quien in (cabeceras, estudiante):  # profesor y estudiante
        assert cliente.get("/metricas/uso", headers=quien).status_code == 403
        assert cliente.get("/metricas/uso/usuarios", headers=quien).status_code == 403
        assert cliente.get(f"/metricas/uso/usuarios/{uid}", headers=quien).status_code == 403
    assert cliente.get("/metricas/uso").status_code in (401, 403)


def test_la_respuesta_no_expone_datos_sensibles(cliente, admin, estudiante):
    cuerpo = cliente.get("/metricas/uso/usuarios", headers=admin).text.lower()
    for prohibido in ("contrasena", "hash", "api_key", "foto_perfil"):
        assert prohibido not in cuerpo
