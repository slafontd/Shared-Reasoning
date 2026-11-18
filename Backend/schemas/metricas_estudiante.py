"""Esquemas de las métricas de un estudiante (seguimiento individual del
profesor)."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PerfilEstudiante(BaseModel):
    """Información disponible del estudiante. Nunca incluye contraseña, API
    keys ni la foto de perfil."""
    estudiante_id: UUID
    nombre: str
    email: str
    nivel: str
    # False hasta que contestó la encuesta de nivel: en ese caso `nivel` es
    # solo el valor por defecto.
    nivel_confirmado: bool
    fecha_registro: datetime | None
    ultimo_acceso: datetime | None
    activo: bool
    desactivado_por_inactividad: bool


class ProgresoGlobal(BaseModel):
    """Ejercicios de todos los cursos (del profesor) en que está inscrito."""
    cursos: int
    total_ejercicios: int
    completados: int
    en_progreso: int
    sin_iniciar: int
    porcentaje: int
    entregas_con_feedback: int
    revisados: int


class ProgresoCursoEstudiante(BaseModel):
    curso_id: UUID
    curso_nombre: str
    fecha_inscripcion: datetime
    total_ejercicios: int
    completados: int
    en_progreso: int
    sin_iniciar: int
    porcentaje: int
    entregas_con_feedback: int
    revisados: int
    ultima_actividad: datetime | None


class ActividadCircuitos(BaseModel):
    """Uso de la herramienta (esquemático → guía de armado). Solo agregados:
    no expone el contenido de los chats ni de los circuitos."""
    sesiones: int
    sesiones_finalizadas: int
    tiempo_total_segundos: float
    tiempo_promedio_segundos: float | None
    interacciones_chat: int
    ultima_sesion: datetime | None


class EventoActividad(BaseModel):
    tipo: str  # "entrega" | "borrador" | "circuito"
    descripcion: str
    curso_nombre: str | None = None
    fecha: datetime


class MetricasEstudiante(BaseModel):
    perfil: PerfilEstudiante
    progreso: ProgresoGlobal
    cursos: list[ProgresoCursoEstudiante]
    circuitos: ActividadCircuitos
    actividad_reciente: list[EventoActividad]
