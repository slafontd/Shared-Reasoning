"""Reto diario: un quiz corto generado por IA para reforzar fundamentos de
electrónica, con dificultad ajustada al nivel del usuario (`Usuario.nivel`).

Hay UN reto por usuario y por día (día local, ZONA_HORARIA): se genera la
primera vez que se pide y queda guardado, así que reabrir la pantalla devuelve
el mismo reto y completarlo cuenta una sola vez. Al completarlo se guarda
cómo le fue; de ahí sale la RACHA de días seguidos (ver `calcular_racha`).

La nota se califica en el navegador (el reto ya trae las respuestas); el
servidor solo valida que los aciertos no superen las preguntas y calcula el XP
con eso. La racha cuenta completar el reto, sin importar la nota.
"""

import asyncio
import json
import logging
import os
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from actividad import RETO, registrar_evento
from auth import obtener_usuario_actual
from db.database import get_db
from db.models import RetoDiarioUsuario, Usuario
from providers.catalogo import CATALOGO, PROVEEDOR_RAZONAMIENTO, crear_provider_chat, esta_configurado
from schemas.retos import CompletarRetoRequest, DiaReto, RachaResponse, RetoDiario, RetoDiarioHoy

ZONA_HORARIA = os.getenv("ZONA_HORARIA", "America/Bogota")
router = APIRouter(prefix="/retos", tags=["retos"])
log = logging.getLogger(__name__)

XP_POR_NIVEL = {"basico": 150, "intermedio": 250, "experto": 350}

PROMPT_RETO = """Eres un profesor experto en electrónica básica.
Genera un reto diario de electrónica para un estudiante de nivel: {nivel}.
El reto debe evaluar sus conocimientos teóricos de forma interactiva.

INSTRUCCIONES:
1. Genera 3 preguntas en total.
2. Mezcla tipos entre "opcion_multiple" y "relacionar".
3. Para "opcion_multiple": 4 opciones claras y el índice (0-3) de la respuesta correcta.
4. Para "relacionar": exactamente 4 pares de término/definición.
5. El título debe ser atractivo y la descripción motivadora, en español neutro.
6. xp_recompensa = {xp}.
7. Las preguntas deben tratar fundamentos de electrónica: componentes pasivos, circuitos serie/paralelo, leyes de Kirchhoff y de Ohm.
8. Ajusta la dificultad al nivel "{nivel}":
   - basico: conceptos muy básicos, símbolos, funciones elementales.
   - intermedio: cálculos básicos con la Ley de Ohm, comportamiento serie/paralelo, uso de protoboard.
   - experto: cálculos de potencia, divisores de tensión/corriente, análisis de mallas/nodos simples, transistores o capacitores.

Responde ÚNICAMENTE con un JSON válido que siga exactamente esta forma, sin texto adicional ni bloques de código markdown:
{{
    "titulo": "...",
    "descripcion": "...",
    "xp_recompensa": {xp},
    "preguntas": [
        {{"tipo": "opcion_multiple", "pregunta": "...", "opciones": ["...", "...", "...", "..."], "respuesta_correcta": 0, "pista": "..."}},
        {{"tipo": "relacionar", "pregunta": "...", "pares": [{{"termino": "...", "definicion": "..."}}], "pista": "..."}}
    ]
}}"""


def _crear_provider_reto():
    """gpt-4o-mini si el servidor tiene key de OpenAI; si no, el primer modelo
    de razonamiento del catálogo que sí tenga key configurada (ej. Gemini).
    Los locales (Ollama) no cuentan: no se sabe si están encendidos."""
    candidatos = [PROVEEDOR_RAZONAMIENTO] + [
        clave for clave, cfg in CATALOGO.items() if "razon" in cfg["roles"] and cfg["categoria"] != "local"
    ]
    for clave in candidatos:
        if clave in CATALOGO and esta_configurado(clave):
            return crear_provider_chat(clave)
    raise RuntimeError("No hay ningún proveedor de IA con API key configurada en el servidor.")


def _validar_reto(reto: RetoDiario) -> RetoDiario:
    """Descarta respuestas de la IA que se verían rotas en la pantalla del reto."""
    if not 1 <= len(reto.preguntas) <= 5:
        raise ValueError("El reto debe tener entre 1 y 5 preguntas.")
    for p in reto.preguntas:
        if p.tipo == "opcion_multiple":
            if not p.opciones or len(p.opciones) < 2 or p.respuesta_correcta is None or not 0 <= p.respuesta_correcta < len(p.opciones):
                raise ValueError("Pregunta de opción múltiple mal formada.")
        else:
            definiciones = [par.definicion for par in (p.pares or [])]
            if len(definiciones) < 2 or len(set(definiciones)) != len(definiciones):
                raise ValueError("Pregunta de relacionar mal formada.")
    return reto


async def generar_reto_diario(nivel: str, intentos: int = 2) -> RetoDiario:
    """Pide el reto a la IA; ante un fallo pasajero (503 por demanda, JSON
    roto) reintenta una vez antes de rendirse."""
    for intento in range(intentos):
        try:
            return await _generar_una_vez(nivel)
        except Exception:
            if intento == intentos - 1:
                raise
            await asyncio.sleep(2)


async def _generar_una_vez(nivel: str) -> RetoDiario:
    nivel = nivel if nivel in XP_POR_NIVEL else "intermedio"
    xp = XP_POR_NIVEL[nivel]
    proveedor = _crear_provider_reto()
    respuesta = await proveedor.client.chat.completions.create(
        model=proveedor.model,
        messages=[{"role": "user", "content": PROMPT_RETO.format(nivel=nivel, xp=xp)}],
    )
    texto = (respuesta.choices[0].message.content or "").strip()
    texto = texto.replace("```json", "").replace("```", "").strip()
    return _validar_reto(RetoDiario(**json.loads(texto)))


# ------------------------------------------------------------
#  Retos de respaldo: si la IA no está disponible (sin API key, sin cuota o
#  con una respuesta inservible) el usuario igual tiene su reto del día. Rotan
#  por día; el XP depende del nivel, como en los generados.
# ------------------------------------------------------------

def _mc(pregunta: str, opciones: list[str], correcta: int, pista: str) -> dict:
    return {"tipo": "opcion_multiple", "pregunta": pregunta, "opciones": opciones, "respuesta_correcta": correcta, "pista": pista}


def _rel(pregunta: str, pares: list[tuple[str, str]], pista: str) -> dict:
    return {"tipo": "relacionar", "pregunta": pregunta, "pares": [{"termino": t, "definicion": d} for t, d in pares], "pista": pista}


RETOS_RESPALDO = [
    {
        "titulo": "Reto diario: Ley de Ohm",
        "descripcion": "Repasa la relación entre voltaje, corriente y resistencia con tres preguntas rápidas.",
        "preguntas": [
            _mc("¿Cuál es la fórmula de la Ley de Ohm?", ["I = V × R", "V = I × R", "R = V × I", "V = I / R"], 1,
                "El voltaje es el producto de la corriente por la resistencia."),
            _mc("Una resistencia de 100 Ω tiene 5 V entre sus terminales. ¿Qué corriente circula por ella?",
                ["20 A", "0,5 A", "500 A", "0,05 A"], 3, "Corriente = voltaje / resistencia."),
            _rel("Relaciona cada magnitud con su unidad.", [
                ("Voltaje", "Se mide en voltios (V)"), ("Corriente", "Se mide en amperios (A)"),
                ("Resistencia", "Se mide en ohmios (Ω)"), ("Potencia", "Se mide en vatios (W)"),
            ], "Cada magnitud tiene su propia unidad."),
        ],
    },
    {
        "titulo": "Reto diario: componentes en la protoboard",
        "descripcion": "Identifica qué hace cada componente y cómo conectar un LED sin quemarlo.",
        "preguntas": [
            _mc("¿Qué pata de un LED va hacia el lado positivo del circuito?",
                ["El cátodo (pata corta)", "Ninguna, es indiferente", "El ánodo (pata larga)", "Las dos al mismo tiempo"], 2,
                "La pata más larga es el ánodo."),
            _mc("¿Para qué se conecta una resistencia en serie con un LED?",
                ["Para que brille de otro color", "Para limitar la corriente y evitar que se queme", "Para aumentar el voltaje", "Para almacenar carga"], 1,
                "Un LED sin límite de corriente se daña."),
            _rel("Relaciona cada componente con su función.", [
                ("Resistor", "Limita el paso de la corriente"), ("Capacitor", "Almacena carga eléctrica"),
                ("Diodo", "Deja pasar la corriente en un solo sentido"), ("Interruptor", "Abre o cierra el circuito"),
            ], "Piensa en lo que hace cada pieza dentro del circuito."),
        ],
    },
    {
        "titulo": "Reto diario: serie y paralelo",
        "descripcion": "Calcula resistencias equivalentes y repasa las leyes de Kirchhoff.",
        "preguntas": [
            _mc("Dos resistencias de 100 Ω conectadas en serie dan una resistencia total de:",
                ["50 Ω", "100 Ω", "10 000 Ω", "200 Ω"], 3, "En serie, las resistencias se suman."),
            _mc("Dos resistencias iguales de 100 Ω conectadas en paralelo dan una resistencia total de:",
                ["200 Ω", "50 Ω", "100 Ω", "25 Ω"], 1, "En paralelo con valores iguales, el total es la mitad."),
            _rel("Relaciona cada concepto con su descripción.", [
                ("Circuito en serie", "Por todos los componentes pasa la misma corriente"),
                ("Circuito en paralelo", "Todos los componentes tienen el mismo voltaje"),
                ("Ley de corrientes de Kirchhoff", "La suma de corrientes que entran a un nodo es cero"),
                ("Ley de voltajes de Kirchhoff", "La suma de voltajes en una malla cerrada es cero"),
            ], "Fíjate en qué magnitud se conserva en cada caso."),
        ],
    },
]


def reto_de_respaldo(nivel: str, dia: date) -> RetoDiario:
    nivel = nivel if nivel in XP_POR_NIVEL else "intermedio"
    base = RETOS_RESPALDO[dia.toordinal() % len(RETOS_RESPALDO)]
    return RetoDiario(**base, xp_recompensa=XP_POR_NIVEL[nivel])


# ============================================================
#  Reto del día y racha
# ============================================================

def _hoy_local(db: Session) -> date:
    return db.query(func.date(func.timezone(ZONA_HORARIA, func.now()))).scalar()


def _fila_del_dia(db: Session, usuario_id, dia: date) -> RetoDiarioUsuario | None:
    return db.query(RetoDiarioUsuario).filter(
        RetoDiarioUsuario.usuario_id == usuario_id, RetoDiarioUsuario.fecha == dia
    ).first()


def _a_respuesta(fila: RetoDiarioUsuario) -> RetoDiarioHoy:
    return RetoDiarioHoy(
        **fila.reto,
        fecha=fila.fecha,
        completado=fila.completado_en is not None,
        aciertos=fila.aciertos,
        xp_ganado=fila.xp_ganado,
    )


def calcular_racha(db: Session, usuario_id) -> RachaResponse:
    hoy = _hoy_local(db)
    filas = db.query(RetoDiarioUsuario.fecha, RetoDiarioUsuario.xp_ganado).filter(
        RetoDiarioUsuario.usuario_id == usuario_id, RetoDiarioUsuario.completado_en.isnot(None)
    ).all()
    dias = {fecha for fecha, _ in filas}

    # Racha actual: hacia atrás desde hoy; si hoy aún no lo completa, desde ayer.
    d = hoy if hoy in dias else hoy - timedelta(days=1)
    actual = 0
    while d in dias:
        actual += 1
        d -= timedelta(days=1)

    mejor = corrida = 0
    anterior = None
    for d in sorted(dias):
        corrida = corrida + 1 if anterior is not None and d - anterior == timedelta(days=1) else 1
        mejor = max(mejor, corrida)
        anterior = d

    return RachaResponse(
        racha_actual=actual,
        mejor_racha=mejor,
        completado_hoy=hoy in dias,
        en_riesgo=actual > 0 and hoy not in dias,
        dias_completados=len(dias),
        xp_total=sum(xp or 0 for _, xp in filas),
        ultimos_dias=[
            DiaReto(fecha=hoy - timedelta(days=k), completado=(hoy - timedelta(days=k)) in dias)
            for k in range(6, -1, -1)
        ],
    )


@router.get("/diario", response_model=RetoDiarioHoy)
async def reto_diario(usuario: Usuario = Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    """El reto de hoy: se genera la primera vez y después es siempre el mismo."""
    hoy = _hoy_local(db)
    fila = _fila_del_dia(db, usuario.id, hoy)
    if fila is None:
        try:
            reto = await generar_reto_diario(usuario.nivel)
        except Exception as e:
            # La IA no está disponible o respondió algo inservible: el usuario
            # no se queda sin reto (ni sin racha), se le da uno de respaldo.
            log.warning("No se pudo generar el reto con IA (%s); se usa uno de respaldo.", type(e).__name__)
            reto = reto_de_respaldo(usuario.nivel, hoy)
        fila = RetoDiarioUsuario(usuario_id=usuario.id, fecha=hoy, reto=reto.model_dump())
        db.add(fila)
        try:
            db.commit()
        except IntegrityError:
            # Dos pestañas a la vez: gana la primera, esta lee la ya guardada.
            db.rollback()
            fila = _fila_del_dia(db, usuario.id, hoy)
        else:
            db.refresh(fila)
    return _a_respuesta(fila)


@router.post("/diario/completar", response_model=RachaResponse)
def completar_reto_diario(
    datos: CompletarRetoRequest,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    """Marca el reto de hoy como completado (una sola vez) y devuelve la racha."""
    fila = _fila_del_dia(db, usuario.id, _hoy_local(db))
    if fila is None:
        raise HTTPException(status_code=404, detail="Primero abre tu reto de hoy.")
    if fila.completado_en is None:
        total = len(fila.reto.get("preguntas", []))
        if datos.aciertos > total:
            raise HTTPException(status_code=422, detail=f"El reto tiene {total} preguntas: no puede haber {datos.aciertos} aciertos.")
        fila.aciertos = datos.aciertos
        fila.xp_ganado = round(datos.aciertos / total * fila.reto.get("xp_recompensa", 0)) if total else 0
        fila.completado_en = func.now()
        db.commit()
        registrar_evento(usuario.id, RETO)
    return calcular_racha(db, usuario.id)


@router.get("/racha", response_model=RachaResponse)
def racha(usuario: Usuario = Depends(obtener_usuario_actual), db: Session = Depends(get_db)):
    return calcular_racha(db, usuario.id)
