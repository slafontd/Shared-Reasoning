"""Esquemas de las métricas de uso de la plataforma (US30)."""

from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel


class PeriodoUso(BaseModel):
    dias: int
    desde: date
    hasta: date
    zona_horaria: str


class ResumenUso(BaseModel):
    eventos: int
    # Lo que los usuarios HACEN (circuitos, preguntas al asistente, entregas…);
    # no incluye iniciar sesión ni el simple uso de la app.
    interacciones: int
    inicios_sesion: int
    usuarios_activos: int
    # Cuentas activas hoy: la base contra la que se mide la frecuencia.
    usuarios_totales: int
    # % de las cuentas activas que usaron la plataforma en el periodo (0–100).
    porcentaje_activos: int
    promedio_interacciones_por_usuario: float
    promedio_dias_activos: float


class PuntoDiario(BaseModel):
    fecha: date
    interacciones: int
    inicios_sesion: int
    usuarios_activos: int


class TotalPorTipo(BaseModel):
    tipo: str
    etiqueta: str
    total: int
    es_interaccion: bool


class UsoPorRol(BaseModel):
    rol: str
    usuarios_activos: int
    interacciones: int


class UsoPorHora(BaseModel):
    hora: int  # 0–23, en la zona horaria del periodo
    eventos: int


class UsoPlataforma(BaseModel):
    periodo: PeriodoUso
    resumen: ResumenUso
    serie_diaria: list[PuntoDiario]
    por_tipo: list[TotalPorTipo]
    por_rol: list[UsoPorRol]
    por_hora: list[UsoPorHora]


class UsoDeUsuario(BaseModel):
    usuario_id: UUID
    nombre: str
    email: str
    rol: str
    interacciones: int
    inicios_sesion: int
    dias_activos: int
    # % de los días del periodo en que tuvo actividad (0–100).
    frecuencia: int
    ultima_actividad: datetime | None


class ListaUsoUsuarios(BaseModel):
    periodo: PeriodoUso
    total: int  # usuarios que cumplen el filtro (la lista puede mostrar menos)
    usuarios: list[UsoDeUsuario]


class EventoReciente(BaseModel):
    tipo: str
    etiqueta: str
    fecha: datetime


class DetalleUsoUsuario(BaseModel):
    periodo: PeriodoUso
    usuario: UsoDeUsuario
    ultimo_acceso: datetime | None
    serie_diaria: list[PuntoDiario]
    por_tipo: list[TotalPorTipo]
    recientes: list[EventoReciente]
