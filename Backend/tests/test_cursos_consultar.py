"""US09 — Consultar cursos (issue #12)."""

import uuid

from conftest import registrar


def crear(cliente, cabeceras, nombre, codigo=None):
    respuesta = cliente.post("/cursos", json={"nombre": nombre, "codigo": codigo}, headers=cabeceras)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()


def test_lista_vacia_cuando_no_hay_cursos(cliente, cabeceras):
    respuesta = cliente.get("/cursos", headers=cabeceras)
    assert respuesta.status_code == 200
    assert respuesta.json() == []


def test_lista_todos_los_cursos_del_mas_reciente_al_mas_antiguo(cliente, cabeceras):
    crear(cliente, cabeceras, "Primero")
    crear(cliente, cabeceras, "Segundo")
    crear(cliente, cabeceras, "Tercero")
    nombres = [c["nombre"] for c in cliente.get("/cursos", headers=cabeceras).json()]
    assert nombres == ["Tercero", "Segundo", "Primero"]


def test_se_ven_los_cursos_creados_por_otros_usuarios(cliente, cabeceras):
    crear(cliente, cabeceras, "Curso de Ana")
    otro = registrar(cliente, email="beto@eafit.edu.co", nombre="Beto").json()["access_token"]
    cursos = cliente.get("/cursos", headers={"Authorization": f"Bearer {otro}"}).json()
    assert [(c["nombre"], c["creado_por_nombre"]) for c in cursos] == [("Curso de Ana", "Ana Pérez")]


def test_busqueda_por_nombre_o_codigo_sin_distinguir_mayusculas_ni_tildes(cliente, cabeceras):
    crear(cliente, cabeceras, "Circuitos Eléctricos I", "ST0263")
    crear(cliente, cabeceras, "Electrónica Digital", "ST0270")
    crear(cliente, cabeceras, "Física II")

    def buscar(termino):
        return sorted(c["nombre"] for c in cliente.get("/cursos", params={"busqueda": termino}, headers=cabeceras).json())

    assert buscar("circuitos") == ["Circuitos Eléctricos I"]
    assert buscar("st02") == ["Circuitos Eléctricos I", "Electrónica Digital"]
    assert buscar("ELECTR") == ["Circuitos Eléctricos I", "Electrónica Digital"]
    assert buscar("   ") == ["Circuitos Eléctricos I", "Electrónica Digital", "Física II"]
    assert buscar("electricos") == ["Circuitos Eléctricos I"]  # sin tilde encuentra con tilde
    assert buscar("fisica") == ["Física II"]
    assert buscar("FÍSICA") == ["Física II"]
    assert buscar("química") == []


def test_los_comodines_se_buscan_literalmente(cliente, cabeceras):
    crear(cliente, cabeceras, "Curso normal")
    crear(cliente, cabeceras, "Avance 100% práctico")
    assert [c["nombre"] for c in cliente.get("/cursos", params={"busqueda": "%"}, headers=cabeceras).json()] == ["Avance 100% práctico"]
    assert cliente.get("/cursos", params={"busqueda": "_"}, headers=cabeceras).json() == []


def test_paginacion(cliente, cabeceras):
    for i in range(5):
        crear(cliente, cabeceras, f"Curso {i}")
    pagina1 = cliente.get("/cursos", params={"limite": 2}, headers=cabeceras).json()
    pagina2 = cliente.get("/cursos", params={"limite": 2, "desplazamiento": 2}, headers=cabeceras).json()
    assert [c["nombre"] for c in pagina1] == ["Curso 4", "Curso 3"]
    assert [c["nombre"] for c in pagina2] == ["Curso 2", "Curso 1"]
    assert cliente.get("/cursos", params={"limite": 101}, headers=cabeceras).status_code == 422


def test_detalle_de_un_curso(cliente, cabeceras):
    creado = crear(cliente, cabeceras, "Circuitos Eléctricos I", "ST0263")
    respuesta = cliente.get(f"/cursos/{creado['id']}", headers=cabeceras)
    assert respuesta.status_code == 200
    assert respuesta.json() == creado


def test_detalle_de_curso_inexistente_da_404(cliente, cabeceras):
    respuesta = cliente.get(f"/cursos/{uuid.uuid4()}", headers=cabeceras)
    assert respuesta.status_code == 404
    assert respuesta.json()["detail"] == "Curso no encontrado."


def test_sin_sesion_no_se_pueden_consultar(cliente):
    assert cliente.get("/cursos").status_code in (401, 403)
