"""US17 — Eliminar ejercicio (issue #21), más la base mínima de ejercicios."""

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


def crear_ejercicio(cliente, cabeceras, curso, titulo="Ley de Ohm", enunciado="Calcula la corriente."):
    respuesta = cliente.post(
        f"/cursos/{curso['id']}/ejercicios", json={"titulo": titulo, "enunciado": enunciado}, headers=cabeceras
    )
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def titulos(cliente, cabeceras, curso):
    return [e["titulo"] for e in cliente.get(f"/cursos/{curso['id']}/ejercicios", headers=cabeceras).json()]


# --- US17: eliminar ---

def test_el_profesor_elimina_un_ejercicio_y_deja_de_estar_disponible(cliente, cabeceras, curso, estudiante):
    ohm = crear_ejercicio(cliente, cabeceras, curso, "Ley de Ohm")
    crear_ejercicio(cliente, cabeceras, curso, "Divisor de voltaje")

    respuesta = cliente.delete(f"/ejercicios/{ohm['id']}", headers=cabeceras)
    assert respuesta.status_code == 204

    # Ya no aparece ni para el profesor ni para los estudiantes inscritos.
    assert titulos(cliente, cabeceras, curso) == ["Divisor de voltaje"]
    assert titulos(cliente, estudiante, curso) == ["Divisor de voltaje"]


def test_eliminar_dos_veces_da_404(cliente, cabeceras, curso):
    ejercicio = crear_ejercicio(cliente, cabeceras, curso)
    assert cliente.delete(f"/ejercicios/{ejercicio['id']}", headers=cabeceras).status_code == 204
    respuesta = cliente.delete(f"/ejercicios/{ejercicio['id']}", headers=cabeceras)
    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == "El ejercicio no existe o ya fue eliminado."


def test_ejercicio_inexistente_da_404(cliente, cabeceras):
    assert cliente.delete(f"/ejercicios/{uuid.uuid4()}", headers=cabeceras).status_code == 404


def test_un_estudiante_no_puede_eliminar_ejercicios(cliente, cabeceras, curso, estudiante):
    ejercicio = crear_ejercicio(cliente, cabeceras, curso)
    assert cliente.delete(f"/ejercicios/{ejercicio['id']}", headers=estudiante).status_code == 403
    assert titulos(cliente, cabeceras, curso) == ["Ley de Ohm"]


def test_otro_profesor_no_puede_eliminar_ejercicios_de_un_curso_ajeno(cliente, cabeceras, curso):
    ejercicio = crear_ejercicio(cliente, cabeceras, curso)
    otro = crear_usuario(cliente, email="pablo@eafit.edu.co", nombre="Pablo", rol="profesor")
    assert cliente.delete(f"/ejercicios/{ejercicio['id']}", headers=otro).status_code == 403


def test_un_administrador_puede_eliminar_cualquier_ejercicio(cliente, cabeceras, curso):
    ejercicio = crear_ejercicio(cliente, cabeceras, curso)
    admin = crear_usuario(cliente, email="admin@eafit.edu.co", nombre="Admin", rol="administrador")
    assert cliente.delete(f"/ejercicios/{ejercicio['id']}", headers=admin).status_code == 204


def test_al_eliminar_el_curso_se_eliminan_sus_ejercicios(cliente, cabeceras, curso):
    ejercicio = crear_ejercicio(cliente, cabeceras, curso)
    assert cliente.delete(f"/cursos/{curso['id']}", headers=cabeceras).status_code == 204
    assert cliente.delete(f"/ejercicios/{ejercicio['id']}", headers=cabeceras).status_code == 404


def test_sin_sesion_no_se_puede_eliminar(cliente, cabeceras, curso):
    ejercicio = crear_ejercicio(cliente, cabeceras, curso)
    assert cliente.delete(f"/ejercicios/{ejercicio['id']}").status_code in (401, 403)


# --- Base mínima: crear y listar ---

def test_solo_el_profesor_del_curso_crea_ejercicios(cliente, curso, estudiante):
    otro = crear_usuario(cliente, email="pablo@eafit.edu.co", nombre="Pablo", rol="profesor")
    for quien in (estudiante, otro):
        respuesta = cliente.post(f"/cursos/{curso['id']}/ejercicios", json={"titulo": "Intruso"}, headers=quien)
        assert respuesta.status_code == 403


def test_titulo_obligatorio(cliente, cabeceras, curso):
    for titulo in ["", "  ", "ab", "x" * 151]:
        respuesta = cliente.post(f"/cursos/{curso['id']}/ejercicios", json={"titulo": titulo}, headers=cabeceras)
        assert respuesta.status_code == 422, titulo


def test_solo_inscritos_y_profesor_ven_los_ejercicios(cliente, cabeceras, curso, estudiante):
    crear_ejercicio(cliente, cabeceras, curso)
    no_inscrito = crear_usuario(cliente, email="nora@eafit.edu.co", nombre="Nora")
    assert cliente.get(f"/cursos/{curso['id']}/ejercicios", headers=estudiante).status_code == 200
    respuesta = cliente.get(f"/cursos/{curso['id']}/ejercicios", headers=no_inscrito)
    assert respuesta.status_code == 403
    assert respuesta.json()["detail"] == "Inscríbete en el curso para ver sus ejercicios."


def test_curso_inexistente_da_404(cliente, cabeceras):
    assert cliente.get(f"/cursos/{uuid.uuid4()}/ejercicios", headers=cabeceras).status_code == 404
