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
