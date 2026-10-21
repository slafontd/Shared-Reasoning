"""US12 — Buscar curso mediante código (issue #15)."""

import re

from codigos_curso import ALFABETO, LONGITUD, normalizar_codigo
from conftest import crear_usuario


def crear(cliente, cabeceras, nombre="Circuitos Eléctricos I"):
    respuesta = cliente.post("/cursos", json={"nombre": nombre, "codigo": "ST0263"}, headers=cabeceras)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def test_cada_curso_nuevo_recibe_un_codigo_de_acceso_unico(cliente, cabeceras):
    codigos = {crear(cliente, cabeceras, f"Curso {i}")["codigo_acceso"] for i in range(10)}
    assert len(codigos) == 10
    for codigo in codigos:
        assert len(codigo) == LONGITUD
        assert re.fullmatch(f"[{ALFABETO}]+", codigo)


def test_el_estudiante_encuentra_el_curso_con_el_codigo(cliente, cabeceras):
    curso = crear(cliente, cabeceras)
    estudiante = crear_usuario(cliente, email="esteban@eafit.edu.co", nombre="Esteban")

    respuesta = cliente.get(f"/cursos/codigo/{curso['codigo_acceso']}", headers=estudiante)
    assert respuesta.status_code == 200
    encontrado = respuesta.json()
    assert encontrado["id"] == curso["id"]
    assert encontrado["nombre"] == "Circuitos Eléctricos I"
    assert encontrado["creado_por_nombre"] == "Ana Pérez"


def test_el_codigo_se_acepta_en_minusculas_con_espacios_o_guiones(cliente, cabeceras):
    codigo = crear(cliente, cabeceras)["codigo_acceso"]
    estudiante = crear_usuario(cliente, email="esteban@eafit.edu.co", nombre="Esteban")
    escrito = f" {codigo[:3].lower()}-{codigo[3:].lower()} "
    assert cliente.get(f"/cursos/codigo/{escrito}", headers=estudiante).status_code == 200


def test_codigo_inexistente_informa_que_no_existe(cliente, cabeceras):
    crear(cliente, cabeceras)
    estudiante = crear_usuario(cliente, email="esteban@eafit.edu.co", nombre="Esteban")
    for codigo in ["ZZZZZZ", "abc", "x" * 40]:
        respuesta = cliente.get(f"/cursos/codigo/{codigo}", headers=estudiante)
        assert respuesta.status_code == 404, codigo
        assert respuesta.json()["detail"] == "No existe ningún curso con ese código. Revisa que esté bien escrito."


def test_el_codigo_de_materia_no_sirve_como_codigo_de_acceso(cliente, cabeceras):
    # "ST0263" se repite entre grupos: no identifica un curso.
    crear(cliente, cabeceras)
    assert cliente.get("/cursos/codigo/ST0263", headers=cabeceras).status_code == 404


def test_solo_el_creador_y_los_administradores_ven_el_codigo_de_acceso(cliente, cabeceras):
    curso = crear(cliente, cabeceras)
    estudiante = crear_usuario(cliente, email="esteban@eafit.edu.co", nombre="Esteban")
    otro_profesor = crear_usuario(cliente, email="pablo@eafit.edu.co", nombre="Pablo", rol="profesor")
    admin = crear_usuario(cliente, email="admin@eafit.edu.co", nombre="Admin", rol="administrador")

    def codigo_visto_por(cabeceras_usuario):
        return cliente.get(f"/cursos/{curso['id']}", headers=cabeceras_usuario).json()["codigo_acceso"]

    assert codigo_visto_por(cabeceras) == curso["codigo_acceso"]
    assert codigo_visto_por(admin) == curso["codigo_acceso"]
    assert codigo_visto_por(estudiante) is None
    assert codigo_visto_por(otro_profesor) is None
    # Tampoco aparece en el listado general.
    assert [c["codigo_acceso"] for c in cliente.get("/cursos", headers=estudiante).json()] == [None]


def test_sin_sesion_no_se_puede_buscar(cliente):
    assert cliente.get("/cursos/codigo/ABCDEF").status_code in (401, 403)


def test_normalizar_codigo():
    assert normalizar_codigo(" k7p2-qx ") == "K7P2QX"
