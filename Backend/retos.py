"""Reto diario: un quiz corto generado por IA para reforzar fundamentos de
electrónica, con dificultad ajustada al nivel del usuario (`Usuario.nivel`).

Se genera al vuelo en cada petición, sin persistencia — es contenido
educativo derivado, igual que el tutorial de `materiales.py`, no un dato del
circuito que deba sobrevivir entre sesiones. Si más adelante se quiere una
racha o un XP acumulado de verdad, hace falta una tabla nueva y un endpoint
que la actualice; por ahora no se inventa un número falso en el frontend para
no mostrar como real algo que el backend no respalda.
"""

import json

from providers.catalogo import crear_provider_razonamiento
from schemas.retos import RetoDiario

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


async def generar_reto_diario(nivel: str) -> RetoDiario:
    nivel = nivel if nivel in XP_POR_NIVEL else "intermedio"
    xp = XP_POR_NIVEL[nivel]
    proveedor = crear_provider_razonamiento()
    respuesta = await proveedor.client.chat.completions.create(
        model=proveedor.model,
        messages=[{"role": "user", "content": PROMPT_RETO.format(nivel=nivel, xp=xp)}],
    )
    texto = (respuesta.choices[0].message.content or "").strip()
    texto = texto.replace("```json", "").replace("```", "").strip()
    return RetoDiario(**json.loads(texto))
