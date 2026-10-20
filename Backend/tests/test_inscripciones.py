"""US13 — Inscribirse a un curso (issue #16)."""

import pytest

from conftest import crear_usuario


@pytest.fixture
def curso(cliente, cabeceras):
    respuesta = cliente.post("/cursos", json={"nombre": "Circuitos Eléctricos I"}, headers=cabeceras)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


@pytest.fixture
def estudiante(cliente):
    return crear_usuario(cliente, email="esteban@eafit.edu.co", nombre="Esteban")


def inscribir(cliente, cabeceras, codigo):
    return cliente.post("/cursos/inscripciones", json={"codigo": codigo}, headers=cabeceras)


def test_el_estudiante_se_inscribe_con_el_codigo(cliente, curso, estudiante):
    respuesta = inscribir(cliente, estudiante, curso["codigo_acceso"])
    assert respuesta.status_code == 201
    assert respuesta.json()["id"] == curso["id"]
    assert respuesta.json()["inscrito"] is True


def test_el_curso_aparece_entre_los_cursos_del_estudiante(cliente, cabeceras, curso, estudiante):
    otro = cliente.post("/cursos", json={"nombre": "Física II"}, headers=cabeceras).json()
    cliente.post("/cursos", json={"nombre": "Curso al que no se inscribe"}, headers=cabeceras)

    assert cliente.get("/cursos/mis-cursos", headers=estudiante).json() == []
    inscribir(cliente, estudiante, curso["codigo_acceso"])
    inscribir(cliente, estudiante, otro["codigo_acceso"].lower())

    mis_cursos = cliente.get("/cursos/mis-cursos", headers=estudiante).json()
    assert [c["nombre"] for c in mis_cursos] == ["Física II", "Circuitos Eléctricos I"]
    assert all(c["inscrito"] for c in mis_cursos)


def test_el_listado_general_marca_los_cursos_inscritos(cliente, cabeceras, curso, estudiante):
    cliente.post("/cursos", json={"nombre": "Otro curso"}, headers=cabeceras)
    inscribir(cliente, estudiante, curso["codigo_acceso"])
    marcados = {c["nombre"]: c["inscrito"] for c in cliente.get("/cursos", headers=estudiante).json()}
    assert marcados == {"Circuitos Eléctricos I": True, "Otro curso": False}
    assert cliente.get(f"/cursos/{curso['id']}", headers=estudiante).json()["inscrito"] is True
    assert cliente.get(f"/cursos/codigo/{curso['codigo_acceso']}", headers=estudiante).json()["inscrito"] is True


def test_codigo_inexistente_no_inscribe(cliente, curso, estudiante):
    respuesta = inscribir(cliente, estudiante, "ZZZZZZ")
    assert respuesta.status_code == 404
    assert "No existe ningún curso" in respuesta.json()["detail"]
    assert cliente.get("/cursos/mis-cursos", headers=estudiante).json() == []


def test_no_se_puede_inscribir_dos_veces(cliente, curso, estudiante):
    assert inscribir(cliente, estudiante, curso["codigo_acceso"]).status_code == 201
    respuesta = inscribir(cliente, estudiante, curso["codigo_acceso"])
    assert respuesta.status_code == 409
    assert respuesta.json()["detail"] == "Ya estás inscrito en este curso."
    assert len(cliente.get("/cursos/mis-cursos", headers=estudiante).json()) == 1


def test_solo_los_estudiantes_se_inscriben(cliente, cabeceras, curso):
    admin = crear_usuario(cliente, email="admin@eafit.edu.co", nombre="Admin", rol="administrador")
    for quien in (cabeceras, admin):  # profesor y administrador
        assert inscribir(cliente, quien, curso["codigo_acceso"]).status_code == 403


def test_codigo_vacio_da_422(cliente, estudiante):
    assert inscribir(cliente, estudiante, "").status_code == 422


def test_al_eliminar_el_curso_desaparece_de_mis_cursos(cliente, cabeceras, curso, estudiante):
    inscribir(cliente, estudiante, curso["codigo_acceso"])
    assert cliente.delete(f"/cursos/{curso['id']}", headers=cabeceras).status_code == 204
    assert cliente.get("/cursos/mis-cursos", headers=estudiante).json() == []


def test_sin_sesion_no_se_puede_inscribir(cliente, curso):
    assert cliente.post("/cursos/inscripciones", json={"codigo": curso["codigo_acceso"]}).status_code in (401, 403)
    assert cliente.get("/cursos/mis-cursos").status_code in (401, 403)
