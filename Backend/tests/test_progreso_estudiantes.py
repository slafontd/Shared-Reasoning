"""Panel de seguimiento docente del progreso real de sus estudiantes."""

import pytest

from conftest import crear_usuario


@pytest.fixture
def curso(cliente, cabeceras):
    respuesta = cliente.post("/cursos", json={"nombre": "Circuitos I"}, headers=cabeceras)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


@pytest.fixture
def ejercicios(cliente, cabeceras, curso):
    resultado = []
    for titulo in ("Ley de Ohm", "Resistencias", "Circuito serie"):
        respuesta = cliente.post(
            f"/cursos/{curso['id']}/ejercicios",
            json={"titulo": titulo},
            headers=cabeceras,
        )
        assert respuesta.status_code == 201, respuesta.text
        resultado.append(respuesta.json())
    return resultado


@pytest.fixture
def estudiante(cliente, curso):
    cabeceras = crear_usuario(cliente, email="estudiante@eafit.edu.co", nombre="María Pérez")
    respuesta = cliente.post(
        "/cursos/inscripciones",
        json={"codigo": curso["codigo_acceso"]},
        headers=cabeceras,
    )
    assert respuesta.status_code == 201, respuesta.text
    return cabeceras, respuesta.json()["id"]


def test_profesor_consulta_estudiantes_y_progreso_real(
    cliente, cabeceras, curso, ejercicios, estudiante
):
    auth, estudiante_id = estudiante
    progreso = cliente.put(
        f"/ejercicios/{ejercicios[1]['id']}/progreso",
        json={"respuestas": {"respuesta": "borrador"}, "punto_actual": 0},
        headers=auth,
    )
    assert progreso.status_code == 200
    entrega = cliente.post(
        f"/ejercicios/{ejercicios[0]['id']}/solucion",
        data={"texto": "solución"},
        headers=auth,
    )
    assert entrega.status_code == 200

    resumen = cliente.get(
        f"/cursos/{curso['id']}/progreso-estudiantes",
        headers=cabeceras,
    )
    assert resumen.status_code == 200, resumen.text
    datos = resumen.json()
    assert datos["curso_nombre"] == "Circuitos I"
    assert datos["total_ejercicios"] == 3
    assert len(datos["estudiantes"]) == 1
    maria = datos["estudiantes"][0]
    assert maria["estudiante_id"] == estudiante_id
    assert maria["nombre"] == "María Pérez"
    assert maria["completados"] == 1
    assert maria["en_progreso"] == 1
    assert maria["sin_iniciar"] == 1
    assert maria["porcentaje"] == 33
    assert maria["ultima_actividad"] is not None


def test_detalle_muestra_estado_y_ultima_actividad(
    cliente, cabeceras, curso, ejercicios, estudiante
):
    auth, estudiante_id = estudiante
    cliente.put(
        f"/ejercicios/{ejercicios[1]['id']}/progreso",
        json={"respuestas": {"respuesta": "borrador"}},
        headers=auth,
    )
    detalle = cliente.get(
        f"/cursos/{curso['id']}/progreso-estudiantes/{estudiante_id}",
        headers=cabeceras,
    )
    assert detalle.status_code == 200, detalle.text
    datos = detalle.json()
    assert datos["estudiante_nombre"] == "María Pérez"
    assert [ejercicio["estado"] for ejercicio in datos["ejercicios"]] == [
        "no_iniciado",
        "en_progreso",
        "no_iniciado",
    ]
    assert datos["ejercicios"][1]["ultima_actividad"] is not None


def test_profesor_marca_y_quita_revision_sin_alterar_progreso(
    cliente, cabeceras, curso, ejercicios, estudiante
):
    auth, estudiante_id = estudiante
    cliente.put(
        f"/ejercicios/{ejercicios[0]['id']}/progreso",
        json={"respuestas": {"respuesta": "avance"}, "punto_actual": 1},
        headers=auth,
    )
    url = (
        f"/cursos/{curso['id']}/progreso-estudiantes/{estudiante_id}"
        f"/ejercicios/{ejercicios[0]['id']}/revision"
    )
    marcada = cliente.put(url, json={"revisado": True}, headers=cabeceras)
    assert marcada.status_code == 200, marcada.text
    assert marcada.json()["revisado"] is True
    assert marcada.json()["revisado_en"] is not None

    detalle = cliente.get(
        f"/cursos/{curso['id']}/progreso-estudiantes/{estudiante_id}",
        headers=cabeceras,
    ).json()
    ejercicio = detalle["ejercicios"][0]
    assert ejercicio["estado"] == "en_progreso"
    assert ejercicio["revisado"] is True

    desmarcada = cliente.put(url, json={"revisado": False}, headers=cabeceras)
    assert desmarcada.status_code == 200
    assert desmarcada.json()["revisado"] is False
    assert desmarcada.json()["revisado_en"] is None


def test_otro_profesor_no_consulta_ni_revisa_curso_ajeno(
    cliente, curso, ejercicios, estudiante
):
    otro = crear_usuario(cliente, email="otroprofesor@eafit.edu.co", nombre="Otro", rol="profesor")
    _, estudiante_id = estudiante
    assert cliente.get(
        f"/cursos/{curso['id']}/progreso-estudiantes",
        headers=otro,
    ).status_code == 403
    assert cliente.get(
        f"/cursos/{curso['id']}/progreso-estudiantes/{estudiante_id}",
        headers=otro,
    ).status_code == 403
    assert cliente.put(
        f"/cursos/{curso['id']}/progreso-estudiantes/{estudiante_id}"
        f"/ejercicios/{ejercicios[0]['id']}/revision",
        json={"revisado": True},
        headers=otro,
    ).status_code == 403


def test_estudiante_no_consulta_panel_docente_y_sin_inscripcion_no_aparece(
    cliente, cabeceras, curso, estudiante
):
    auth, estudiante_id = estudiante
    assert cliente.get(
        f"/cursos/{curso['id']}/progreso-estudiantes",
        headers=auth,
    ).status_code == 403
    lista = cliente.get(
        f"/cursos/{curso['id']}/progreso-estudiantes",
        headers=cabeceras,
    ).json()["estudiantes"]
    assert [persona["estudiante_id"] for persona in lista] == [estudiante_id]
