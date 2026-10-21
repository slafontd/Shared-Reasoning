"""US16 — Actualizar ejercicio."""

import uuid

import pytest

from conftest import crear_usuario


@pytest.fixture
def curso(cliente, cabeceras):
    respuesta = cliente.post("/cursos", json={"nombre": "Circuitos Eléctricos I"}, headers=cabeceras)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


@pytest.fixture
def estudiante(cliente, curso):
    cabeceras_estudiante = crear_usuario(cliente, email="esteban@eafit.edu.co", nombre="Esteban")
    respuesta = cliente.post("/cursos/inscripciones", json={"codigo": curso["codigo_acceso"]}, headers=cabeceras_estudiante)
    assert respuesta.status_code == 201, respuesta.text
    return cabeceras_estudiante


@pytest.fixture
def ejercicio(cliente, cabeceras, curso):
    respuesta = cliente.post(
        f"/cursos/{curso['id']}/ejercicios",
        json={"titulo": "Ley de Ohm", "enunciado": "Calcula la corriente."},
        headers=cabeceras,
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def listado(cliente, cabeceras, curso):
    return cliente.get(f"/cursos/{curso['id']}/ejercicios", headers=cabeceras).json()


def test_el_profesor_modifica_titulo_y_enunciado(cliente, cabeceras, curso, ejercicio):
    respuesta = cliente.patch(
        f"/ejercicios/{ejercicio['id']}",
        json={"titulo": "Ley de Ohm (v2)", "enunciado": "Calcula la corriente con R = 220 Ω."},
        headers=cabeceras,
    )
    assert respuesta.status_code == 200, respuesta.text
    cuerpo = respuesta.json()
    assert cuerpo["titulo"] == "Ley de Ohm (v2)"
    assert cuerpo["enunciado"] == "Calcula la corriente con R = 220 Ω."
    assert cuerpo["fecha_actualizacion"] is not None
    assert ejercicio["fecha_actualizacion"] is None


def test_los_cambios_quedan_guardados_y_los_estudiantes_ven_la_version_nueva(cliente, cabeceras, curso, ejercicio, estudiante):
    cliente.patch(f"/ejercicios/{ejercicio['id']}", json={"enunciado": "Enunciado corregido."}, headers=cabeceras)
    for quien in (cabeceras, estudiante):
        [e] = listado(cliente, quien, curso)
        assert e["titulo"] == "Ley de Ohm"  # lo no enviado no cambia
        assert e["enunciado"] == "Enunciado corregido."
        assert e["fecha_actualizacion"] is not None


def test_enunciado_vacio_lo_borra(cliente, cabeceras, curso, ejercicio):
    respuesta = cliente.patch(f"/ejercicios/{ejercicio['id']}", json={"enunciado": "   "}, headers=cabeceras)
    assert respuesta.status_code == 200
    assert respuesta.json()["enunciado"] is None


def test_titulo_invalido_no_se_acepta(cliente, cabeceras, ejercicio):
    for titulo in ["", "  ", "ab", "x" * 151, None]:
        respuesta = cliente.patch(f"/ejercicios/{ejercicio['id']}", json={"titulo": titulo}, headers=cabeceras)
        assert respuesta.status_code == 422, titulo


def test_sin_campos_no_hay_nada_que_actualizar(cliente, cabeceras, ejercicio):
    assert cliente.patch(f"/ejercicios/{ejercicio['id']}", json={}, headers=cabeceras).status_code == 422


def test_editar_conserva_imagenes_y_soluciones(cliente, cabeceras, curso, ejercicio, estudiante):
    cliente.post(f"/ejercicios/{ejercicio['id']}/solucion", data={"texto": "I = V/R"}, headers=estudiante)
    cliente.patch(f"/ejercicios/{ejercicio['id']}", json={"titulo": "Ley de Ohm II"}, headers=cabeceras)
    [e] = listado(cliente, estudiante, curso)
    assert e["mi_solucion"]["texto"] == "I = V/R"
    [e] = listado(cliente, cabeceras, curso)
    assert e["total_soluciones"] == 1


def test_solo_el_profesor_del_curso_puede_modificar(cliente, cabeceras, ejercicio, estudiante):
    otro = crear_usuario(cliente, email="pablo@eafit.edu.co", nombre="Pablo", rol="profesor")
    admin = crear_usuario(cliente, email="admin@eafit.edu.co", nombre="Admin", rol="administrador")
    for quien in (estudiante, otro, admin):
        respuesta = cliente.patch(f"/ejercicios/{ejercicio['id']}", json={"titulo": "Intruso"}, headers=quien)
        assert respuesta.status_code == 403
    assert cliente.patch(f"/ejercicios/{ejercicio['id']}", json={"titulo": "Intruso"}).status_code in (401, 403)


def test_ejercicio_inexistente_da_404(cliente, cabeceras):
    respuesta = cliente.patch(f"/ejercicios/{uuid.uuid4()}", json={"titulo": "Nuevo título"}, headers=cabeceras)
    assert respuesta.status_code == 404
