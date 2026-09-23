"""Configuración común de las pruebas del backend.

Las pruebas corren contra una base PostgreSQL de PRUEBA (los modelos usan
tipos propios de Postgres como UUID y JSONB, así que SQLite no sirve). Se
indica con la variable TEST_DATABASE_URL, por ejemplo:

    TEST_DATABASE_URL=postgresql://postgres@localhost:5432/paralelo_test pytest

⚠️ Cada prueba BORRA el contenido de las tablas: nunca apuntes
TEST_DATABASE_URL a la base de datos real (Supabase) del proyecto.
"""

import os

import pytest

TEST_DATABASE_URL = os.getenv("TEST_DATABASE_URL")
if not TEST_DATABASE_URL:
    pytest.exit(
        "Define TEST_DATABASE_URL con una base PostgreSQL de pruebas (ver tests/conftest.py).",
        returncode=1,
    )

# Deben quedar fijadas ANTES de importar la app: db/database.py y auth.py
# leen el entorno al importarse (load_dotenv no pisa variables ya definidas).
os.environ["DATABASE_URL"] = TEST_DATABASE_URL
os.environ.setdefault("JWT_SECRET_KEY", "secreto-solo-para-pruebas-no-usar-en-produccion")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import text  # noqa: E402

import rate_limit  # noqa: E402
from db.database import Base, engine  # noqa: E402
from main import app  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _crear_tablas():
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture(autouse=True)
def _limpiar_estado():
    """Cada prueba arranca con tablas vacías y sin historial de rate limiting."""
    tablas = ", ".join(t.name for t in Base.metadata.sorted_tables)
    with engine.begin() as conexion:
        conexion.execute(text(f"TRUNCATE {tablas} CASCADE"))
    rate_limit._peticiones.clear()
    yield


@pytest.fixture
def cliente():
    return TestClient(app)


CONTRASENA_VALIDA = "ClaveSegura123"


def registrar(cliente, email="ana.perez@eafit.edu.co", nombre="Ana Pérez", contrasena=CONTRASENA_VALIDA):
    return cliente.post("/auth/registro", json={"nombre": nombre, "email": email, "contrasena": contrasena})


@pytest.fixture
def token(cliente):
    respuesta = registrar(cliente)
    assert respuesta.status_code == 201, respuesta.text
    return respuesta.json()["access_token"]


@pytest.fixture
def cabeceras(token):
    return {"Authorization": f"Bearer {token}"}
