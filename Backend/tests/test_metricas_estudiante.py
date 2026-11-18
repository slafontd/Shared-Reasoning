"""Métricas de un estudiante — seguimiento individual del profesor."""

import uuid

import pytest

from conftest import crear_usuario


def crear_curso(cliente, cabeceras, nombre):
    r = cliente.post("/cursos", json={"nombre": nombre}, headers=cabeceras)
    assert r.status_code == 201, r.text
    return r.json()


def crear_ejercicio(cliente, cabeceras, curso, titulo):
    r = cliente.post(f"/cursos/{curso['id']}/ejercicios", json={"titulo": titulo}, headers=cabeceras)
    assert r.status_code == 201, r.text
    return r.json()


def inscribir(cliente, cabeceras, curso):
    r = cliente.post("/cursos/inscripciones", json={"codigo": curso["codigo_acceso"]}, headers=cabeceras)
    assert r.status_code == 201, r.text


def id_de(cliente, cabeceras):
    return cliente.get("/auth/me", headers=cabeceras).json()["usuario_id"]


@pytest.fixture
def escenario(cliente, cabeceras):
    """Profesora Ana (fixture `cabeceras`): Circuitos con 3 ejercicios. Profesor
    Beto: Electrónica con 1 ejercicio. El estudiante Esteban está en ambos
    cursos; Nora solo en el de Beto."""
    beto = crear_usuario(cliente, email="beto@eafit.edu.co", nombre="Beto", rol="profesor")
    esteban = crear_usuario(cliente, email="esteban@eafit.edu.co", nombre="Esteban")
    nora = crear_usuario(cliente, email="nora@eafit.edu.co", nombre="Nora")

    circuitos = crear_curso(cliente, cabeceras, "Circuitos")
    electronica = crear_curso(cliente, beto, "Electrónica")
    inscribir(cliente, esteban, circuitos)
    inscribir(cliente, esteban, electronica)
    inscribir(cliente, nora, electronica)

    ohm = crear_ejercicio(cliente, cabeceras, circuitos, "Ohm")
    divisor = crear_ejercicio(cliente, cabeceras, circuitos, "Divisor")
    crear_ejercicio(cliente, cabeceras, circuitos, "LED")
    transistor = crear_ejercicio(cliente, beto, electronica, "Transistor")

    entrega = cliente.post(f"/ejercicios/{ohm['id']}/solucion", data={"texto": "I = V/R"}, headers=esteban).json()
    cliente.put(
        f"/ejercicios/{ohm['id']}/soluciones/{entrega['id']}/feedback",
        json={"comentario": "Bien hecho."},
        headers=cabeceras,
    )
    cliente.put(
        f"/ejercicios/{divisor['id']}/progreso",
        json={"respuestas": {"a": 1}, "preguntas_completadas": [], "punto_actual": 1},
        headers=esteban,
    )
    cliente.post(f"/ejercicios/{transistor['id']}/solucion", data={"texto": "x"}, headers=esteban)

    sesion = cliente.post(
        "/sesiones",
        json={"nombre": "Divisor con LED", "netlist": {"componentes": [], "conexiones": []}, "instrucciones": []},
        headers=esteban,
    ).json()["sesion_id"]
    cliente.post(
        f"/sesiones/{sesion}/finalizar",
        json={"tiempo_total_segundos": 120.5, "tiempo_por_paso": {"1": 60}},
        headers=esteban,
    )
    return {
        "ana": cabeceras, "beto": beto, "esteban": esteban, "nora": nora,
        "esteban_id": id_de(cliente, esteban), "nora_id": id_de(cliente, nora),
    }


def test_el_profesor_ve_la_informacion_y_el_progreso_de_su_estudiante(cliente, escenario):
    r = cliente.get(f"/metricas/estudiantes/{escenario['esteban_id']}", headers=escenario["ana"])
    assert r.status_code == 200, r.text
    m = r.json()
    assert m["perfil"]["nombre"] == "Esteban"
    assert m["perfil"]["email"] == "esteban@eafit.edu.co"
    assert m["perfil"]["activo"] is True
    assert m["progreso"] == {
        "cursos": 1, "total_ejercicios": 3, "completados": 1, "en_progreso": 1, "sin_iniciar": 1,
        "porcentaje": 33, "entregas_con_feedback": 1, "revisados": 0,
    }
    assert [c["curso_nombre"] for c in m["cursos"]] == ["Circuitos"]


def test_el_profesor_solo_ve_sus_propios_cursos(cliente, escenario):
    m = cliente.get(f"/metricas/estudiantes/{escenario['esteban_id']}", headers=escenario["beto"]).json()
    assert [c["curso_nombre"] for c in m["cursos"]] == ["Electrónica"]
    assert m["progreso"]["completados"] == 1
    assert "Ohm" not in str(m["actividad_reciente"])


def test_actividad_con_circuitos_y_reciente(cliente, escenario):
    m = cliente.get(f"/metricas/estudiantes/{escenario['esteban_id']}", headers=escenario["ana"]).json()
    assert m["circuitos"]["sesiones"] == 1
    assert m["circuitos"]["sesiones_finalizadas"] == 1
    assert m["circuitos"]["tiempo_total_segundos"] == 120.5
    tipos = sorted(e["tipo"] for e in m["actividad_reciente"])
    assert tipos == ["borrador", "circuito", "entrega"]
    fechas = [e["fecha"] for e in m["actividad_reciente"]]
    assert fechas == sorted(fechas, reverse=True)


def test_la_revision_se_refleja_en_las_metricas(cliente, escenario):
    cursos = cliente.get("/cursos/mis-cursos", headers=escenario["ana"]).json()
    ejercicio = cliente.get(f"/cursos/{cursos[0]['id']}/ejercicios", headers=escenario["ana"]).json()[0]
    r = cliente.put(
        f"/cursos/{cursos[0]['id']}/progreso-estudiantes/{escenario['esteban_id']}/ejercicios/{ejercicio['id']}/revision",
        json={"revisado": True},
        headers=escenario["ana"],
    )
    assert r.status_code == 200, r.text
    m = cliente.get(f"/metricas/estudiantes/{escenario['esteban_id']}", headers=escenario["ana"]).json()
    assert m["progreso"]["revisados"] == 1


def test_no_expone_datos_sensibles(cliente, escenario):
    texto = cliente.get(f"/metricas/estudiantes/{escenario['esteban_id']}", headers=escenario["ana"]).text.lower()
    for prohibido in ("contrasena", "hash", "foto_perfil", "api_keys"):
        assert prohibido not in texto


def test_un_administrador_ve_todos_los_cursos_del_estudiante(cliente, escenario):
    admin = crear_usuario(cliente, email="admin@eafit.edu.co", nombre="Admin", rol="administrador")
    m = cliente.get(f"/metricas/estudiantes/{escenario['esteban_id']}", headers=admin).json()
    assert sorted(c["curso_nombre"] for c in m["cursos"]) == ["Circuitos", "Electrónica"]
    assert m["progreso"]["total_ejercicios"] == 4


def test_un_estudiante_inscrito_solo_en_curso_ajeno_da_404(cliente, escenario):
    r = cliente.get(f"/metricas/estudiantes/{escenario['nora_id']}", headers=escenario["ana"])
    assert r.status_code == 404


def test_sin_actividad_devuelve_ceros(cliente, escenario):
    m = cliente.get(f"/metricas/estudiantes/{escenario['nora_id']}", headers=escenario["beto"]).json()
    assert m["circuitos"]["sesiones"] == 0
    assert m["circuitos"]["tiempo_promedio_segundos"] is None
    assert m["actividad_reciente"] == []


def test_un_estudiante_no_puede_consultar_metricas(cliente, escenario):
    r = cliente.get(f"/metricas/estudiantes/{escenario['esteban_id']}", headers=escenario["esteban"])
    assert r.status_code == 403


def test_ids_invalidos_y_sin_sesion(cliente, escenario):
    assert cliente.get(f"/metricas/estudiantes/{uuid.uuid4()}", headers=escenario["ana"]).status_code == 404
    assert cliente.get("/metricas/estudiantes/abc", headers=escenario["ana"]).status_code == 422
    assert cliente.get(f"/metricas/estudiantes/{escenario['esteban_id']}").status_code in (401, 403)
    # Un profesor no es un estudiante: tampoco se consulta.
    assert cliente.get(f"/metricas/estudiantes/{id_de(cliente, escenario['beto'])}", headers=escenario["ana"]).status_code == 404
