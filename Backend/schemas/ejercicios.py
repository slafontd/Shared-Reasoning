from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


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


class EjercicioActualizar(BaseModel):
    """US16: edición parcial — solo cambia lo que viene en la petición.
    Mandar `enunciado` vacío (o null) lo borra; el título no puede quedar vacío."""
    titulo: str | None = Field(default=None, min_length=3, max_length=150)
    enunciado: str | None = Field(default=None, max_length=5000)

    @field_validator("titulo", mode="before")
    @classmethod
    def una_sola_linea(cls, valor):
        return " ".join(valor.split()) if isinstance(valor, str) else valor

    @field_validator("enunciado", mode="before")
    @classmethod
    def recortar(cls, valor):
        return (valor.strip() or None) if isinstance(valor, str) else valor

    @model_validator(mode="after")
    def algo_que_cambiar(self):
        if not self.model_fields_set:
            raise ValueError("Indica al menos un campo para actualizar (titulo o enunciado).")
        if "titulo" in self.model_fields_set and self.titulo is None:
            raise ValueError("El título no puede quedar vacío.")
        return self


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
    fecha_actualizacion: datetime | None = None
    imagenes: list[ImagenEjercicioResponse] = []
    # Para un estudiante: su propia solución (None si aún no entrega).
    mi_solucion: SolucionResponse | None = None
    # Para quien gestiona el curso: cuántos estudiantes ya entregaron.
    total_soluciones: int | None = None

    model_config = {"from_attributes": True}
