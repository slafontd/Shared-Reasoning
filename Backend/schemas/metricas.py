"""Esquemas de las métricas de la plataforma (EP07: US26, US27, US28)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TotalesEntregas(BaseModel):
    entregas: int
    con_feedback: int
    sin_feedback: int
    # % de entregas que ya recibieron feedback del profesor (0–100).
    tasa_feedback: int


class ResumenMetricas(TotalesEntregas):
    """US26 (#33): totales del dashboard. Para un profesor, todo se limita a
    sus propios cursos y los campos de usuarios vienen en null."""
    alcance: str  # "plataforma" (administrador) o "profesor"
    cursos: int
    estudiantes: int  # estudiantes distintos inscritos en esos cursos
    inscripciones: int
    ejercicios: int
    # Solo para el administrador:
    usuarios_total: int | None = None
    usuarios_por_rol: dict[str, int] | None = None
    activos_7_dias: int | None = None
    activos_30_dias: int | None = None
    desactivados: int | None = None


class MetricasProfesor(TotalesEntregas):
    """US27 (#34)."""
    profesor_id: UUID
    nombre: str
    email: str
    cursos: int
    estudiantes: int
    ejercicios: int
    ultimo_acceso: datetime | None


class MetricasCurso(TotalesEntregas):
    """US28 (#35)."""
    curso_id: UUID
    nombre: str
    codigo: str | None
    profesor_nombre: str
    inscritos: int
    ejercicios: int
    # % de entregas recibidas sobre las posibles (inscritos × ejercicios).
    tasa_entrega: int
    ultima_entrega: datetime | None


class MetricasEjercicio(TotalesEntregas):
    ejercicio_id: UUID
    titulo: str
    # % de inscritos que ya entregaron este ejercicio.
    tasa_entrega: int


class DetalleMetricasCurso(MetricasCurso):
    por_ejercicio: list[MetricasEjercicio]
