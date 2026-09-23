"""US03 — Inicio de sesión (issue #4)."""

from conftest import CONTRASENA_VALIDA, registrar


def test_login_correcto_devuelve_token_y_datos_del_usuario(cliente):
    registrar(cliente)
    respuesta = cliente.post("/auth/login", json={"email": "ana.perez@eafit.edu.co", "contrasena": CONTRASENA_VALIDA})

    assert respuesta.status_code == 200
    datos = respuesta.json()
    assert datos["access_token"]
    assert datos["token_type"] == "bearer"
    assert datos["email"] == "ana.perez@eafit.edu.co"
    assert datos["nombre"] == "Ana Pérez"


def test_el_token_del_login_da_acceso_a_rutas_protegidas(cliente):
    registrar(cliente)
    token = cliente.post(
        "/auth/login", json={"email": "ana.perez@eafit.edu.co", "contrasena": CONTRASENA_VALIDA}
    ).json()["access_token"]

    respuesta = cliente.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert respuesta.status_code == 200
    assert respuesta.json()["email"] == "ana.perez@eafit.edu.co"


def test_login_no_distingue_mayusculas_en_el_correo(cliente):
    registrar(cliente, email="Ana.Perez@EAFIT.edu.co")
    respuesta = cliente.post("/auth/login", json={"email": "  ana.perez@eafit.edu.co ", "contrasena": CONTRASENA_VALIDA})
    assert respuesta.status_code == 200


def test_contrasena_incorrecta_da_401_con_mensaje_generico(cliente):
    registrar(cliente)
    respuesta = cliente.post("/auth/login", json={"email": "ana.perez@eafit.edu.co", "contrasena": "OtraClave12345"})
    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == "Correo o contraseña incorrectos."


def test_correo_inexistente_da_el_mismo_mensaje_que_contrasena_incorrecta(cliente):
    # No revela si la cuenta existe (evita enumeración de usuarios).
    respuesta = cliente.post("/auth/login", json={"email": "nadie@eafit.edu.co", "contrasena": CONTRASENA_VALIDA})
    assert respuesta.status_code == 401
    assert respuesta.json()["detail"] == "Correo o contraseña incorrectos."


def test_campos_vacios_dan_422(cliente):
    respuesta = cliente.post("/auth/login", json={"email": "", "contrasena": ""})
    assert respuesta.status_code == 422


def test_token_invalido_da_401(cliente):
    respuesta = cliente.get("/auth/me", headers={"Authorization": "Bearer token-falso"})
    assert respuesta.status_code == 401


def test_demasiados_intentos_seguidos_se_bloquean_temporalmente(cliente):
    for _ in range(20):
        cliente.post("/auth/login", json={"email": "nadie@eafit.edu.co", "contrasena": "x"})
    respuesta = cliente.post("/auth/login", json={"email": "nadie@eafit.edu.co", "contrasena": "x"})
    assert respuesta.status_code == 429
