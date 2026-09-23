"""US08 — Crear curso (issue #11)."""


def test_crear_curso_devuelve_201_con_los_datos(cliente, cabeceras):
    respuesta = cliente.post(
        "/cursos",
        json={"nombre": "Circuitos Eléctricos I", "codigo": "st0263", "descripcion": "Leyes de Ohm y Kirchhoff."},
        headers=cabeceras,
    )
    assert respuesta.status_code == 201
    curso = respuesta.json()
    assert curso["id"]
    assert curso["nombre"] == "Circuitos Eléctricos I"
    assert curso["codigo"] == "ST0263"  # se guarda en mayúsculas
    assert curso["descripcion"] == "Leyes de Ohm y Kirchhoff."
    assert curso["creado_por_nombre"] == "Ana Pérez"
    assert curso["fecha_creacion"]


def test_solo_el_nombre_es_obligatorio(cliente, cabeceras):
    respuesta = cliente.post("/cursos", json={"nombre": "Electrónica básica", "codigo": "  ", "descripcion": ""}, headers=cabeceras)
    assert respuesta.status_code == 201
    assert respuesta.json()["codigo"] is None
    assert respuesta.json()["descripcion"] is None


def test_espacios_sobrantes_del_nombre_se_limpian(cliente, cabeceras):
    respuesta = cliente.post("/cursos", json={"nombre": "  Circuitos    I  "}, headers=cabeceras)
    assert respuesta.json()["nombre"] == "Circuitos I"


def test_nombre_vacio_o_muy_corto_se_rechaza(cliente, cabeceras):
    for nombre in ["", "   ", "ab"]:
        respuesta = cliente.post("/cursos", json={"nombre": nombre}, headers=cabeceras)
        assert respuesta.status_code == 422, nombre


def test_campos_demasiado_largos_se_rechazan(cliente, cabeceras):
    assert cliente.post("/cursos", json={"nombre": "x" * 151}, headers=cabeceras).status_code == 422
    assert cliente.post("/cursos", json={"nombre": "Curso", "codigo": "x" * 21}, headers=cabeceras).status_code == 422
    assert cliente.post("/cursos", json={"nombre": "Curso", "descripcion": "x" * 2001}, headers=cabeceras).status_code == 422


def test_sin_sesion_no_se_puede_crear_un_curso(cliente):
    respuesta = cliente.post("/cursos", json={"nombre": "Circuitos"})
    assert respuesta.status_code in (401, 403)
