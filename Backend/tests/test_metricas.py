"""EP07 — US26 dashboard (#33), US27 métricas por profesor (#34) y US28
métricas por curso (#35)."""

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


def entregar(cliente, cabeceras, ejercicio):
    r = cliente.post(f"/ejercicios/{ejercicio['id']}/solucion", data={"texto": "Mi respuesta"}, headers=cabeceras)
    assert r.status_code == 200, r.text
    return r.json()


def dar_feedback(cliente, cabeceras, ejercicio, entrega):
    r = cliente.put(
        f"/ejercicios/{ejercicio['id']}/soluciones/{entrega['id']}/feedback",
        json={"comentario": "Bien hecho."},
        headers=cabeceras,
    )
    assert r.status_code == 200, r.text


@pytest.fixture
def escenario(cliente, cabeceras):
    """Profesora Ana: Circuitos (2 ejercicios, 2 estudiantes) y Física (1
    ejercicio, sin estudiantes). Profesor Beto: Electrónica (1 ejercicio,
    1 estudiante)."""
    beto = crear_usuario(cliente, email="beto@eafit.edu.co", nombre="Beto", rol="profesor")
    s1 = crear_usuario(cliente, email="s1@eafit.edu.co", nombre="Sara")
    s2 = crear_usuario(cliente, email="s2@eafit.edu.co", nombre="Simón")

    circuitos = crear_curso(cliente, cabeceras, "Circuitos")
    fisica = crear_curso(cliente, cabeceras, "Física")
    electronica = crear_curso(cliente, beto, "Electrónica")
    e1 = crear_ejercicio(cliente, cabeceras, circuitos, "Ley de Ohm")
    e2 = crear_ejercicio(cliente, cabeceras, circuitos, "Divisor de voltaje")
    crear_ejercicio(cliente, cabeceras, fisica, "Caída libre")
    e3 = crear_ejercicio(cliente, beto, electronica, "Compuertas")

    inscribir(cliente, s1, circuitos)
    inscribir(cliente, s2, circuitos)
    inscribir(cliente, s1, electronica)

    dar_feedback(cliente, cabeceras, e1, entregar(cliente, s1, e1))
    entregar(cliente, s2, e1)  # sin feedback
    dar_feedback(cliente, cabeceras, e2, entregar(cliente, s1, e2))
    entregar(cliente, s1, e3)  # sin feedback

    return {"beto": beto, "s1": s1, "circuitos": circuitos, "fisica": fisica, "electronica": electronica}


@pytest.fixture
def admin(cliente):
    return crear_usuario(cliente, email="admin@eafit.edu.co", nombre="Admin", rol="administrador")


# --- US26: dashboard ---

def test_el_administrador_ve_los_totales_de_toda_la_plataforma(cliente, escenario, admin):
    r = cliente.get("/metricas/resumen", headers=admin)
    assert r.status_code == 200
    d = r.json()
    assert d["alcance"] == "plataforma"
    assert (d["cursos"], d["ejercicios"], d["inscripciones"], d["estudiantes"]) == (3, 4, 3, 2)
    assert (d["entregas"], d["con_feedback"], d["sin_feedback"], d["tasa_feedback"]) == (4, 2, 2, 50)
    assert d["usuarios_total"] == 5
    assert d["usuarios_por_rol"] == {"administrador": 1, "estudiante": 2, "profesor": 2}
    assert d["activos_7_dias"] == 5  # todos iniciaron sesión hoy
    assert d["desactivados"] == 0


def test_un_profesor_ve_solo_los_totales_de_sus_cursos(cliente, cabeceras, escenario):
    d = cliente.get("/metricas/resumen", headers=cabeceras).json()
    assert d["alcance"] == "profesor"
    assert (d["cursos"], d["ejercicios"], d["inscripciones"], d["estudiantes"]) == (2, 3, 2, 2)
    assert (d["entregas"], d["con_feedback"], d["sin_feedback"]) == (3, 2, 1)
    assert d["usuarios_total"] is None and d["usuarios_por_rol"] is None


def test_dashboard_vacio_no_falla(cliente, cabeceras):
    d = cliente.get("/metricas/resumen", headers=cabeceras).json()
    assert (d["cursos"], d["entregas"], d["tasa_feedback"]) == (0, 0, 0)


def test_los_estudiantes_no_ven_metricas(cliente, escenario):
    for ruta in ["/metricas/resumen", "/metricas/profesores", "/metricas/cursos",
                 f"/metricas/cursos/{escenario['circuitos']['id']}"]:
        assert cliente.get(ruta, headers=escenario["s1"]).status_code == 403, ruta


# --- US27: por profesor ---

def test_el_administrador_ve_las_metricas_de_cada_profesor(cliente, escenario, admin):
    filas = {f["nombre"]: f for f in cliente.get("/metricas/profesores", headers=admin).json()}
    assert set(filas) == {"Ana Pérez", "Beto"}
    ana, beto = filas["Ana Pérez"], filas["Beto"]
    assert (ana["cursos"], ana["estudiantes"], ana["ejercicios"]) == (2, 2, 3)
    assert (ana["entregas"], ana["con_feedback"], ana["sin_feedback"], ana["tasa_feedback"]) == (3, 2, 1, 67)
    assert (beto["cursos"], beto["estudiantes"], beto["ejercicios"]) == (1, 1, 1)
    assert (beto["entregas"], beto["sin_feedback"]) == (1, 1)
    assert ana["ultimo_acceso"] is not None


def test_un_profesor_solo_ve_su_propia_fila(cliente, cabeceras, escenario):
    filas = cliente.get("/metricas/profesores", headers=cabeceras).json()
    assert [f["nombre"] for f in filas] == ["Ana Pérez"]


def test_profesor_sin_cursos_aparece_en_cero(cliente, admin):
    crear_usuario(cliente, email="nuevo@eafit.edu.co", nombre="Nuevo Profe", rol="profesor")
    filas = cliente.get("/metricas/profesores", headers=admin).json()
    assert [(f["nombre"], f["cursos"], f["entregas"]) for f in filas] == [("Nuevo Profe", 0, 0)]


# --- US28: por curso ---

def test_metricas_de_cada_curso(cliente, escenario, admin):
    filas = {f["nombre"]: f for f in cliente.get("/metricas/cursos", headers=admin).json()}
    assert set(filas) == {"Circuitos", "Física", "Electrónica"}
    c = filas["Circuitos"]
    assert (c["inscritos"], c["ejercicios"], c["entregas"]) == (2, 2, 3)
    assert c["tasa_entrega"] == 75  # 3 entregas de 4 posibles (2 inscritos × 2 ejercicios)
    assert (c["con_feedback"], c["sin_feedback"]) == (2, 1)
    assert c["profesor_nombre"] == "Ana Pérez"
    assert c["ultima_entrega"] is not None
    f = filas["Física"]
    assert (f["inscritos"], f["entregas"], f["tasa_entrega"], f["ultima_entrega"]) == (0, 0, 0, None)


def test_un_profesor_solo_ve_sus_cursos(cliente, cabeceras, escenario):
    nombres = {f["nombre"] for f in cliente.get("/metricas/cursos", headers=cabeceras).json()}
    assert nombres == {"Circuitos", "Física"}


def test_detalle_de_un_curso_por_ejercicio(cliente, cabeceras, escenario):
    r = cliente.get(f"/metricas/cursos/{escenario['circuitos']['id']}", headers=cabeceras)
    assert r.status_code == 200
    d = r.json()
    assert d["tasa_entrega"] == 75
    por = {e["titulo"]: e for e in d["por_ejercicio"]}
    assert (por["Ley de Ohm"]["entregas"], por["Ley de Ohm"]["tasa_entrega"], por["Ley de Ohm"]["sin_feedback"]) == (2, 100, 1)
    assert (por["Divisor de voltaje"]["entregas"], por["Divisor de voltaje"]["tasa_entrega"]) == (1, 50)


def test_un_profesor_no_ve_el_detalle_de_un_curso_ajeno(cliente, cabeceras, escenario):
    r = cliente.get(f"/metricas/cursos/{escenario['electronica']['id']}", headers=cabeceras)
    assert r.status_code == 403


def test_detalle_de_curso_inexistente_da_404(cliente, admin):
    assert cliente.get("/metricas/cursos/00000000-0000-0000-0000-000000000000", headers=admin).status_code == 404
