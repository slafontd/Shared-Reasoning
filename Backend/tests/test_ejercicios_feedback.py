"""Feedback docente persistente en entregas de ejercicios."""

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
    inscripcion = cliente.post(
        "/cursos/inscripciones",
        json={"codigo": curso["codigo_acceso"]},
        headers=cabeceras,
    )
    assert inscripcion.status_code == 201, inscripcion.text
    return cabeceras


@pytest.fixture
def segundo_estudiante(cliente, curso):
    cabeceras = crear_usuario(
        cliente,
        email="otroestudiante@eafit.edu.co",
        nombre="Otro estudiante",
    )
    inscripcion = cliente.post(
        "/cursos/inscripciones",
        json={"codigo": curso["codigo_acceso"]},
        headers=cabeceras,
    )
    assert inscripcion.status_code == 201, inscripcion.text
    return cabeceras


@pytest.fixture
def entrega(cliente, estudiante, ejercicio):
    respuesta = cliente.post(
        f"/ejercicios/{ejercicio['id']}/solucion",
        data={"texto": "Mi respuesta"},
        headers=estudiante,
    )
    assert respuesta.status_code == 200, respuesta.text
    return respuesta.json()


def url_feedback(ejercicio, entrega):
    return f"/ejercicios/{ejercicio['id']}/soluciones/{entrega['id']}/feedback"


def test_profesor_envia_y_actualiza_feedback(cliente, cabeceras, ejercicio, entrega):
    respuesta = cliente.put(
        url_feedback(ejercicio, entrega),
        json={"comentario": "  Revisa el cálculo de la corriente.  "},
        headers=cabeceras,
    )
    assert respuesta.status_code == 200, respuesta.text
    assert respuesta.json()["feedback"] == "Revisa el cálculo de la corriente."
    assert respuesta.json()["feedback_profesor_id"]
    assert respuesta.json()["feedback_actualizado_en"]

    actualizada = cliente.put(
        url_feedback(ejercicio, entrega),
        json={"comentario": "La segunda versión está correcta."},
        headers=cabeceras,
    )
    assert actualizada.status_code == 200
    assert actualizada.json()["feedback"] == "La segunda versión está correcta."
    assert actualizada.json()["feedback_profesor_id"] == respuesta.json()["feedback_profesor_id"]


def test_estudiante_consulta_feedback_en_su_entrega(
    cliente, cabeceras, estudiante, ejercicio, entrega
):
    url = url_feedback(ejercicio, entrega)
    assert cliente.put(
        url,
        json={"comentario": "Buen procedimiento."},
        headers=cabeceras,
    ).status_code == 200

    lista = cliente.get(
        f"/cursos/{ejercicio['curso_id']}/ejercicios",
        headers=estudiante,
    )
    assert lista.status_code == 200, lista.text
    solucion = lista.json()[0]["mi_solucion"]
    assert solucion["id"] == entrega["id"]
    assert solucion["feedback"] == "Buen procedimiento."
    assert solucion["feedback_actualizado_en"]


def test_feedback_esta_vacio_antes_de_la_revision(cliente, estudiante, ejercicio, entrega):
    lista = cliente.get(
        f"/cursos/{ejercicio['curso_id']}/ejercicios",
        headers=estudiante,
    )
    assert lista.status_code == 200
    assert lista.json()[0]["mi_solucion"]["feedback"] is None


def test_un_estudiante_no_puede_ver_feedback_de_otra_entrega(
    cliente, cabeceras, ejercicio, estudiante, segundo_estudiante, entrega
):
    assert cliente.put(
        url_feedback(ejercicio, entrega),
        json={"comentario": "Feedback privado para el primer estudiante."},
        headers=cabeceras,
    ).status_code == 200
    lista = cliente.get(
        f"/cursos/{ejercicio['curso_id']}/ejercicios",
        headers=segundo_estudiante,
    )
    assert lista.status_code == 200
    assert lista.json()[0]["mi_solucion"] is None


def test_nueva_entrega_limpia_feedback_de_la_version_anterior(
    cliente, cabeceras, ejercicio, estudiante, entrega
):
    cliente.put(
        url_feedback(ejercicio, entrega),
        json={"comentario": "Feedback para la versión anterior."},
        headers=cabeceras,
    )
    nueva = cliente.post(
        f"/ejercicios/{ejercicio['id']}/solucion",
        data={"texto": "Nueva versión de mi respuesta."},
        headers=estudiante,
    )
    assert nueva.status_code == 200
    assert nueva.json()["feedback"] is None
    assert nueva.json()["feedback_profesor_id"] is None
    assert nueva.json()["feedback_actualizado_en"] is None


def test_otro_profesor_no_puede_enviar_feedback(cliente, ejercicio, entrega):
    otro_profesor = crear_usuario(
        cliente,
        email="otroprofesor@eafit.edu.co",
        nombre="Otro profesor",
        rol="profesor",
    )
    respuesta = cliente.put(
        url_feedback(ejercicio, entrega),
        json={"comentario": "Comentario no autorizado."},
        headers=otro_profesor,
    )
    assert respuesta.status_code == 403


def test_estudiante_no_puede_enviar_feedback(cliente, estudiante, ejercicio, entrega):
    respuesta = cliente.put(
        url_feedback(ejercicio, entrega),
        json={"comentario": "No autorizado."},
        headers=estudiante,
    )
    assert respuesta.status_code == 403


def test_feedback_rechaza_comentario_vacio(cliente, cabeceras, ejercicio, entrega):
    respuesta = cliente.put(
        url_feedback(ejercicio, entrega),
        json={"comentario": "   "},
        headers=cabeceras,
    )
    assert respuesta.status_code == 422
