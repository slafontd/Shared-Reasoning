from datetime import date
from typing import Literal, Optional

from pydantic import BaseModel, Field


class ParRelacion(BaseModel):
    termino: str = Field(description="El concepto a relacionar.")
    definicion: str = Field(description="La definición correspondiente.")


class PreguntaReto(BaseModel):
    tipo: Literal["opcion_multiple", "relacionar"] = Field(description="El tipo de pregunta.")
    pregunta: str = Field(description="El texto de la pregunta.")
    opciones: Optional[list[str]] = Field(default=None, description="Solo para tipo='opcion_multiple'. 4 opciones de respuesta.")
    respuesta_correcta: Optional[int] = Field(default=None, description="Solo para tipo='opcion_multiple'. Índice (0-3) de la opción correcta.")
    pares: Optional[list[ParRelacion]] = Field(default=None, description="Solo para tipo='relacionar'. 4 pares de concepto/definición.")
    pista: Optional[str] = Field(default=None, description="Una pista opcional para ayudar al usuario.")


class RetoDiario(BaseModel):
    titulo: str = Field(description="Título del reto (ej. 'Reto diario: fundamentos').")
    descripcion: str = Field(description="Breve descripción del objetivo del reto.")
    xp_recompensa: int = Field(description="Cantidad de XP que otorga completarlo.")
    preguntas: list[PreguntaReto] = Field(description="Entre 3 y 5 preguntas para el reto.")


class RetoDiarioHoy(RetoDiario):
    """El reto de hoy más su estado: un mismo reto todo el día."""
    fecha: date
    completado: bool = False
    aciertos: Optional[int] = None
    xp_ganado: Optional[int] = None


class CompletarRetoRequest(BaseModel):
    aciertos: int = Field(ge=0, le=50, description="Preguntas que respondió bien.")


class DiaReto(BaseModel):
    fecha: date
    completado: bool


class RachaResponse(BaseModel):
    # Días seguidos con el reto completado, contando hasta hoy (o hasta ayer si
    # hoy todavía no lo completa: la racha sigue viva hasta que termine el día).
    racha_actual: int
    mejor_racha: int
    completado_hoy: bool
    # Tiene racha pero hoy aún no completa el reto: si no lo hace, la pierde.
    en_riesgo: bool
    dias_completados: int
    xp_total: int
    # Los últimos 7 días (el más antiguo primero, hoy al final).
    ultimos_dias: list[DiaReto]
