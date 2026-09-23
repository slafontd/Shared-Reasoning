"""USXX — Verificación de correo antes de activar la cuenta."""

from conftest import CONTRASENA_VALIDA, registrar


def test_registro_crea_cuenta_no_verificada_y_bloquea_login(cliente):
    respuesta = registrar(cliente, email="nuevo@eafit.edu.co", nombre="Nuevo Usuario")
    assert respuesta.status_code == 201
    datos = respuesta.json()
    assert datos["email_verificado"] is False
    assert "codigo_verificacion" in datos
    assert "access_token" not in datos

    login = cliente.post(
        "/auth/login",
        json={"email": "nuevo@eafit.edu.co", "contrasena": CONTRASENA_VALIDA},
    )
    assert login.status_code == 403
    assert "verificar" in login.json()["detail"].lower()


def test_verificacion_exitosa_activa_la_cuenta(cliente):
    registro = registrar(cliente, email="verifica@eafit.edu.co", nombre="Verificado")
    codigo = registro.json()["codigo_verificacion"]

    verificacion = cliente.post(
        "/auth/verificar-email",
        json={"email": "verifica@eafit.edu.co", "codigo": codigo},
    )
    assert verificacion.status_code == 200
    assert verificacion.json()["email_verificado"] is True

    login = cliente.post(
        "/auth/login",
        json={"email": "verifica@eafit.edu.co", "contrasena": CONTRASENA_VALIDA},
    )
    assert login.status_code == 200
    assert login.json()["email"] == "verifica@eafit.edu.co"
