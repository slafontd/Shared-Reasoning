from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class EjercicioCrear(BaseModel):
    titulo: str = Field(min_length=3, max_length=150)
    enunciado: str | None = Field(default=None, max_length=5000)

    @field_validator("titulo", mode="before")
    @classmethod
    def una_sola_linea(cls, valor):
        return " ".join(valor.split()) if isinstance(valor, str) else valor

    @field_validator("enunciado", mode="before")
    @classmethod
    def recortar(cls, valor):
        return (valor.strip() or None) if isinstance(valor, str) else valor


class ImagenEjercicioResponse(BaseModel):
    id: UUID
    nombre: str
    mime: str
    tamano: int

    model_config = {"from_attributes": True}


class ArchivoSolucionResponse(BaseModel):
    id: UUID
    nombre: str
    mime: str
    tamano: int

    model_config = {"from_attributes": True}


class SolucionResponse(BaseModel):
    id: UUID
    ejercicio_id: UUID
    estudiante_id: UUID
    estudiante_nombre: str
    texto: str | None
    fecha_entrega: datetime
    archivos: list[ArchivoSolucionResponse] = []


class EjercicioResponse(BaseModel):
    id: UUID
    curso_id: UUID
    titulo: str
    enunciado: str | None
    fecha_creacion: datetime
    imagenes: list[ImagenEjercicioResponse] = []
    # Para un estudiante: su propia solución (None si aún no entrega).
    mi_solucion: SolucionResponse | None = None
    # Para quien gestiona el curso: cuántos estudiantes ya entregaron.
    total_soluciones: int | None = None

    model_config = {"from_attributes": True}
