"""Reto diario (uno por día, persistido) y racha de días seguidos."""

import json

import pytest
from sqlalchemy import text

import retos
from conftest import crear_usuario
from schemas.retos import RetoDiario

RETO_JSON = json.dumps({
    "titulo": "x", "descripcion": "x", "xp_recompensa": 300, "preguntas": [{}, {}, {}],
})


@pytest.fixture
def generador(monkeypatch):
    """Reemplaza a la IA por un reto fijo y cuenta cuántas veces se llamó."""
    llamadas = {"n": 0}

    async def falso(nivel):
        llamadas["n"] += 1
        return RetoDiario(
            titulo="Reto de prueba", descripcion="d", xp_recompensa=300,
            preguntas=[
                {"tipo": "opcion_multiple", "pregunta": f"p{i}", "opciones": ["a", "b", "c", "d"], "respuesta_correcta": 0}
                for i in range(3)
            ],
        )

    monkeypatch.setattr(retos, "generar_reto_diario", falso)
    return llamadas


def id_de(cliente, cabeceras):
    return cliente.get("/auth/me", headers=cabeceras).json()["usuario_id"]


def marcar_dia(usuario_id, hace_dias):
    from db.database import SessionLocal
    with SessionLocal() as db:
        db.execute(
            text(
                "INSERT INTO retos_diarios (id, usuario_id, fecha, reto, completado_en, aciertos, xp_ganado) "
                "VALUES (gen_random_uuid(), :u, (now() AT TIME ZONE 'America/Bogota')::date - :d, CAST(:r AS jsonb), now(), 3, 300)"
            ),
            {"u": usuario_id, "d": hace_dias, "r": RETO_JSON},
        )
        db.commit()


def test_el_reto_se_genera_una_vez_al_dia_y_se_conserva(cliente, cabeceras, generador):
    primero = cliente.get("/retos/diario", headers=cabeceras).json()
    segundo = cliente.get("/retos/diario", headers=cabeceras).json()
    assert generador["n"] == 1
    assert primero["preguntas"] == segundo["preguntas"]
    assert primero["completado"] is False


def test_completar_cuenta_una_sola_vez_y_sube_la_racha(cliente, cabeceras, generador):
    cliente.get("/retos/diario", headers=cabeceras)
    racha = cliente.post("/retos/diario/completar", headers=cabeceras, json={"aciertos": 2}).json()
    assert racha["racha_actual"] == 1 and racha["completado_hoy"] is True and racha["en_riesgo"] is False
    assert racha["xp_total"] == 200  # round(2/3 * 300)
    assert len(racha["ultimos_dias"]) == 7 and racha["ultimos_dias"][-1]["completado"] is True

    repetido = cliente.post("/retos/diario/completar", headers=cabeceras, json={"aciertos": 3}).json()
    assert repetido["racha_actual"] == 1 and repetido["xp_total"] == 200 and repetido["dias_completados"] == 1
    hoy = cliente.get("/retos/diario", headers=cabeceras).json()
    assert hoy["completado"] is True and hoy["aciertos"] == 2 and hoy["xp_ganado"] == 200


def test_validaciones_al_completar(cliente, cabeceras, generador):
    assert cliente.post("/retos/diario/completar", headers=cabeceras, json={"aciertos": 1}).status_code == 404
    cliente.get("/retos/diario", headers=cabeceras)
    assert cliente.post("/retos/diario/completar", headers=cabeceras, json={"aciertos": 4}).status_code == 422
    assert cliente.post("/retos/diario/completar", headers=cabeceras, json={"aciertos": -1}).status_code == 422
    assert cliente.get("/retos/diario").status_code in (401, 403)
    assert cliente.get("/retos/racha").status_code in (401, 403)


def test_la_racha_sigue_viva_hasta_el_final_del_dia(cliente, cabeceras, generador):
    uid = id_de(cliente, cabeceras)
    for dias in (1, 2, 3):
        marcar_dia(uid, dias)
    racha = cliente.get("/retos/racha", headers=cabeceras).json()
    assert racha["racha_actual"] == 3 and racha["en_riesgo"] is True and racha["completado_hoy"] is False

    cliente.get("/retos/diario", headers=cabeceras)
    racha = cliente.post("/retos/diario/completar", headers=cabeceras, json={"aciertos": 1}).json()
    assert racha["racha_actual"] == 4 and racha["en_riesgo"] is False and racha["mejor_racha"] == 4


def test_si_ayer_no_lo_hizo_la_racha_se_pierde_pero_queda_la_mejor(cliente, cabeceras):
    marcar_dia(id_de(cliente, cabeceras), 2)
    racha = cliente.get("/retos/racha", headers=cabeceras).json()
    assert racha["racha_actual"] == 0 and racha["mejor_racha"] == 1 and racha["en_riesgo"] is False


def test_racha_con_huecos(cliente, cabeceras):
    uid = id_de(cliente, cabeceras)
    for dias in (6, 5, 4, 1, 0):
        marcar_dia(uid, dias)
    racha = cliente.get("/retos/racha", headers=cabeceras).json()
    assert (racha["racha_actual"], racha["mejor_racha"], racha["dias_completados"]) == (2, 3, 5)
    assert [d["completado"] for d in racha["ultimos_dias"]] == [True, True, True, False, False, True, True]


def test_cada_usuario_tiene_su_propia_racha(cliente, cabeceras):
    otro = crear_usuario(cliente, email="otro@eafit.edu.co", nombre="Otro")
    marcar_dia(id_de(cliente, cabeceras), 0)
    assert cliente.get("/retos/racha", headers=cabeceras).json()["racha_actual"] == 1
    assert cliente.get("/retos/racha", headers=otro).json()["racha_actual"] == 0


# --- respaldo cuando la IA no está disponible ---

def test_si_la_ia_falla_el_usuario_recibe_un_reto_de_respaldo(cliente, cabeceras, monkeypatch):
    async def roto(nivel, intentos=2):
        raise RuntimeError("IA caída")

    monkeypatch.setattr(retos, "generar_reto_diario", roto)
    r = cliente.get("/retos/diario", headers=cabeceras)
    assert r.status_code == 200
    assert len(r.json()["preguntas"]) == 3
    assert cliente.get("/retos/diario", headers=cabeceras).json()["titulo"] == r.json()["titulo"]
    # Y se puede completar y sumar racha como cualquier otro.
    assert cliente.post("/retos/diario/completar", headers=cabeceras, json={"aciertos": 3}).json()["racha_actual"] == 1


def test_los_retos_de_respaldo_son_validos_y_rotan():
    from datetime import date, timedelta

    titulos = set()
    for k in range(3):
        reto = retos.reto_de_respaldo("experto", date(2026, 11, 18) + timedelta(days=k))
        retos._validar_reto(reto)
        assert reto.xp_recompensa == retos.XP_POR_NIVEL["experto"]
        titulos.add(reto.titulo)
    assert len(titulos) == 3


def test_se_descartan_retos_de_la_ia_mal_formados():
    malo = RetoDiario(
        titulo="x", descripcion="x", xp_recompensa=100,
        preguntas=[{"tipo": "opcion_multiple", "pregunta": "p", "opciones": ["a", "b"], "respuesta_correcta": 5}],
    )
    with pytest.raises(ValueError):
        retos._validar_reto(malo)
