from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class EstudianteProgreso(BaseModel):
    estudiante_id: UUID
    nombre: str
    total_ejercicios: int
    completados: int
    en_progreso: int
    sin_iniciar: int
    porcentaje: int = Field(ge=0, le=100)
    ultima_actividad: datetime | None


class CursoProgresoResponse(BaseModel):
    curso_id: UUID
    curso_nombre: str
    total_ejercicios: int
    estudiantes: list[EstudianteProgreso]


class EjercicioProgresoDetalle(BaseModel):
    ejercicio_id: UUID
    titulo: str
    estado: Literal["no_iniciado", "en_progreso", "completado"]
    ultima_actividad: datetime | None
    revisado: bool
    revisado_en: datetime | None


class DetalleProgresoEstudiante(BaseModel):
    estudiante_id: UUID
    estudiante_nombre: str
    curso_id: UUID
    curso_nombre: str
    total_ejercicios: int
    completados: int
    en_progreso: int
    sin_iniciar: int
    porcentaje: int = Field(ge=0, le=100)
    ultima_actividad: datetime | None
    ejercicios: list[EjercicioProgresoDetalle]


class RevisionEjercicioActualizar(BaseModel):
    revisado: bool


class RevisionEjercicioResponse(BaseModel):
    ejercicio_id: UUID
    estudiante_id: UUID
    revisado: bool
    revisado_en: datetime | None
