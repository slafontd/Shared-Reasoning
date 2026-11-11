"""Guardado y recuperación del progreso privado de ejercicios."""

import pytest

from conftest import crear_usuario


@pytest.fixture
def curso(cliente, cabeceras):
    respuesta = cliente.post("/cursos", json={"nombre": "Circuitos I"}, headers=cabeceras)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


@pytest.fixture
def ejercicio(cliente, cabeceras, curso):
    respuesta = cliente.post(
        f"/cursos/{curso['id']}/ejercicios",
        json={"titulo": "Ley de Ohm"},
        headers=cabeceras,
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


@pytest.fixture
def estudiante(cliente, curso):
    cabeceras = crear_usuario(cliente, email="estudiante@eafit.edu.co", nombre="Estudiante")
    respuesta = cliente.post(
        "/cursos/inscripciones",
        json={"codigo": curso["codigo_acceso"]},
        headers=cabeceras,
    )
    assert respuesta.status_code == 201, respuesta.text
    return cabeceras


@pytest.fixture
def segundo_estudiante(cliente, curso):
    cabeceras = crear_usuario(cliente, email="otro@eafit.edu.co", nombre="Otro estudiante")
    respuesta = cliente.post(
        "/cursos/inscripciones",
        json={"codigo": curso["codigo_acceso"]},
        headers=cabeceras,
    )
    assert respuesta.status_code == 201, respuesta.text
    return cabeceras


def url_progreso(ejercicio):
    return f"/ejercicios/{ejercicio['id']}/progreso"


def test_progreso_nuevo_se_inicia_vacio(cliente, estudiante, ejercicio):
    respuesta = cliente.get(url_progreso(ejercicio), headers=estudiante)
    assert respuesta.status_code == 200
    assert respuesta.json() is None


def test_el_progreso_se_guarda_y_se_recupera(cliente, estudiante, ejercicio):
    progreso = {
        "respuestas": {"respuesta": "I = 0.02 A", "pregunta-1": "2 A"},
        "preguntas_completadas": ["pregunta-1"],
        "punto_actual": 1,
    }
    guardado = cliente.put(url_progreso(ejercicio), json=progreso, headers=estudiante)
    assert guardado.status_code == 200, guardado.text
    assert guardado.json()["respuestas"] == progreso["respuestas"]
    assert guardado.json()["preguntas_completadas"] == progreso["preguntas_completadas"]
    assert guardado.json()["punto_actual"] == 1
    assert guardado.json()["actualizado_en"]

    recuperado = cliente.get(url_progreso(ejercicio), headers=estudiante)
    assert recuperado.status_code == 200
    assert recuperado.json()["respuestas"] == progreso["respuestas"]

    progreso["respuestas"]["respuesta"] = "I = 0.03 A"
    progreso["punto_actual"] = 2
    actualizado = cliente.put(url_progreso(ejercicio), json=progreso, headers=estudiante)
    assert actualizado.status_code == 200
    assert actualizado.json()["respuestas"]["respuesta"] == "I = 0.03 A"
    assert actualizado.json()["punto_actual"] == 2


def test_un_estudiante_no_puede_ver_el_progreso_de_otro(
    cliente, estudiante, segundo_estudiante, ejercicio
):
    payload = {
        "respuestas": {"respuesta": "privada"},
        "preguntas_completadas": [],
        "punto_actual": 0,
    }
    assert cliente.put(url_progreso(ejercicio), json=payload, headers=estudiante).status_code == 200

    respuesta = cliente.get(url_progreso(ejercicio), headers=segundo_estudiante)
    assert respuesta.status_code == 200
    assert respuesta.json() is None


def test_solo_estudiantes_inscritos_pueden_acceder_al_progreso(cliente, cabeceras, ejercicio):
    assert cliente.get(url_progreso(ejercicio), headers=cabeceras).status_code == 403
    assert cliente.put(url_progreso(ejercicio), json={}, headers=cabeceras).status_code == 403
    assert cliente.get(url_progreso(ejercicio)).status_code in (401, 403)


def test_progreso_no_supera_el_limite_de_almacenamiento(cliente, estudiante, ejercicio):
    respuesta = cliente.put(
        url_progreso(ejercicio),
        json={"respuestas": {"respuesta": "x" * (64 * 1024)}, "punto_actual": 0},
        headers=estudiante,
    )
    assert respuesta.status_code == 422


def test_entregar_solucion_elimina_el_borrador(cliente, estudiante, ejercicio):
    cliente.put(
        url_progreso(ejercicio),
        json={"respuestas": {"respuesta": "borrador"}, "punto_actual": 0},
        headers=estudiante,
    )
    entrega = cliente.post(
        f"/ejercicios/{ejercicio['id']}/solucion",
        data={"texto": "respuesta final"},
        headers=estudiante,
    )
    assert entrega.status_code == 200
    assert cliente.get(url_progreso(ejercicio), headers=estudiante).json() is None
