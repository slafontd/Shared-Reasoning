"""Registro de la actividad y las interacciones de los usuarios (US30).

Cada hecho relevante deja una fila en `eventos_actividad` (quién, tipo y
cuándo; nunca contenido). Con eso el administrador puede analizar la
frecuencia de uso (ver metricas_uso.py).

Tipos:
- Presencia: `inicio_sesion` (login) y `actividad` (usó la app; como mucho una
  vez por hora por usuario, el mismo ritmo con que se actualiza ultimo_acceso).
- Interacciones: lo que el usuario HACE en la plataforma (circuitos, preguntas
  al asistente, retos, materiales, inscripciones, entregas, feedback, cursos y
  ejercicios creados).

Registrar es de "mejor esfuerzo": usa su propia sesión de BD y traga los
errores, así que un fallo del registro nunca rompe la petición del usuario.
"""

import logging
from uuid import UUID

from db.database import SessionLocal
from db.models import EventoActividad

log = logging.getLogger(__name__)

INICIO_SESION = "inicio_sesion"
ACTIVIDAD = "actividad"

# Interacciones — etiqueta legible para mostrarlas en el dashboard.
CIRCUITO = "circuito"
CHAT = "chat"
RETO = "reto"
MATERIAL = "material"
INSCRIPCION = "inscripcion"
ENTREGA = "entrega"
FEEDBACK = "feedback"
CURSO_CREADO = "curso_creado"
EJERCICIO_CREADO = "ejercicio_creado"

ETIQUETAS = {
    INICIO_SESION: "Inicios de sesión",
    ACTIVIDAD: "Uso de la app",
    CIRCUITO: "Circuitos armados",
    CHAT: "Preguntas al asistente",
    RETO: "Retos diarios",
    MATERIAL: "Materiales subidos",
    INSCRIPCION: "Inscripciones a cursos",
    ENTREGA: "Entregas de ejercicios",
    FEEDBACK: "Feedback a estudiantes",
    CURSO_CREADO: "Cursos creados",
    EJERCICIO_CREADO: "Ejercicios creados",
}

PRESENCIA = (INICIO_SESION, ACTIVIDAD)
# Todo lo que no es solo "estar ahí" cuenta como interacción.
INTERACCIONES = tuple(t for t in ETIQUETAS if t not in PRESENCIA)


def registrar_evento(usuario_id: UUID | str, tipo: str) -> None:
    """Guarda un evento de actividad. Nunca lanza."""
    if tipo not in ETIQUETAS:
        log.warning("Tipo de evento de actividad desconocido: %s", tipo)
        return
    try:
        with SessionLocal() as db:
            db.add(EventoActividad(usuario_id=usuario_id, tipo=tipo))
            db.commit()
    except Exception:  # noqa: BLE001 — el registro no debe romper la petición
        log.exception("No se pudo registrar el evento de actividad %s", tipo)
