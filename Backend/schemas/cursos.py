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
