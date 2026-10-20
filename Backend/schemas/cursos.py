from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CursoCrear(BaseModel):
    nombre: str = Field(min_length=3, max_length=150)
    codigo: str | None = Field(default=None, max_length=20)
    descripcion: str | None = Field(default=None, max_length=2000)

    @field_validator("nombre", "codigo", mode="before")
    @classmethod
    def una_sola_linea(cls, valor):
        # "  Circuitos   I " → "Circuitos I"
        return " ".join(valor.split()) if isinstance(valor, str) else valor

    @field_validator("descripcion", mode="before")
    @classmethod
    def recortar(cls, valor):
        # La descripción conserva sus saltos de línea; solo se recortan los bordes.
        return valor.strip() if isinstance(valor, str) else valor

    @field_validator("codigo", "descripcion")
    @classmethod
    def vacio_a_none(cls, valor: str | None) -> str | None:
        return valor or None

    @field_validator("codigo")
    @classmethod
    def codigo_en_mayusculas(cls, valor: str | None) -> str | None:
        return valor.upper() if valor else valor


class CursoResponse(BaseModel):
    id: UUID
    nombre: str
    codigo: str | None
    descripcion: str | None
    creado_por: UUID
    creado_por_nombre: str
    fecha_creacion: datetime
    # Solo lo ven quien creó el curso y los administradores (US12): es lo que
    # el profesor comparte para que sus estudiantes se inscriban. Para el
    # resto viene en null — conocerlo es justamente lo que da acceso.
    codigo_acceso: str | None = None
    # US13: si el usuario que consulta ya está inscrito en este curso.
    inscrito: bool = False


class InscripcionCrear(BaseModel):
    # El código de acceso del curso (US12); se normaliza en el endpoint.
    codigo: str = Field(min_length=1, max_length=20)
