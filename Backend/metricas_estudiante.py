"""Métricas de un estudiante — seguimiento individual para el profesor.

Quién ve qué:
- Profesor: solo estudiantes inscritos en al menos uno de SUS cursos, y el
  progreso se limita a esos cursos (no ve los de otros profesores).
- Administrador: cualquier estudiante inscrito en algún curso, con todos sus
  cursos.
- Estudiante: nada (403).

Cualquier otro caso (id inexistente, no es estudiante, no inscrito en un curso
visible) responde 404 sin distinguir, para no revelar quién existe.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from auth import requerir_rol
from db.database import get_db
from db.models import (
    ChatMensaje, Curso, Ejercicio, Inscripcion, ProgresoEjercicio, RevisionEjercicio, Sesion, Solucion, Usuario,
)
from roles import ADMINISTRADOR, ESTUDIANTE, PROFESOR
from schemas.metricas_estudiante import (
    ActividadCircuitos, EventoActividad, MetricasEstudiante, PerfilEstudiante, ProgresoCursoEstudiante, ProgresoGlobal,
)

router = APIRouter(prefix="/metricas/estudiantes", tags=["metricas"])
solo_docentes = requerir_rol(ADMINISTRADOR, PROFESOR)

MAX_EVENTOS_RECIENTES = 10


def _porcentaje(parte: int, total: int) -> int:
    return round(parte / total * 100) if total else 0


def _mayor(fechas):
    fechas = [f for f in fechas if f is not None]
    return max(fechas) if fechas else None


@router.get("/{estudiante_id}", response_model=MetricasEstudiante)
def metricas_de_estudiante(
    estudiante_id: UUID,
    usuario: Usuario = Depends(solo_docentes),
    db: Session = Depends(get_db),
):
    estudiante = db.get(Usuario, estudiante_id)

    inscripciones = []
    if estudiante is not None and estudiante.rol == ESTUDIANTE:
        consulta = (
            db.query(Inscripcion)
            .join(Curso, Curso.id == Inscripcion.curso_id)
            .filter(Inscripcion.usuario_id == estudiante.id)
        )
        if usuario.rol == PROFESOR:
            consulta = consulta.filter(Curso.creado_por == usuario.id)
        inscripciones = consulta.order_by(Curso.nombre, Curso.id).all()
    if not inscripciones:
        raise HTTPException(status_code=404, detail="El estudiante no está inscrito en ninguno de tus cursos.")

    cursos = [i.curso for i in inscripciones]
    nombre_curso = {c.id: c.nombre for c in cursos}
    ejercicios = (
        db.query(Ejercicio)
        .filter(Ejercicio.curso_id.in_(list(nombre_curso)))
        .order_by(Ejercicio.fecha_creacion, Ejercicio.id)
        .all()
    )
    ids_ejercicios = [e.id for e in ejercicios]

    soluciones, progresos, revisados = {}, {}, set()
    if ids_ejercicios:
        soluciones = {
            s.ejercicio_id: s
            for s in db.query(Solucion).filter(
                Solucion.estudiante_id == estudiante.id, Solucion.ejercicio_id.in_(ids_ejercicios)
            )
        }
        progresos = {
            p.ejercicio_id: p
            for p in db.query(ProgresoEjercicio).filter(
                ProgresoEjercicio.estudiante_id == estudiante.id, ProgresoEjercicio.ejercicio_id.in_(ids_ejercicios)
            )
        }
        revisados = {
            r.ejercicio_id
            for r in db.query(RevisionEjercicio.ejercicio_id).filter(
                RevisionEjercicio.estudiante_id == estudiante.id, RevisionEjercicio.ejercicio_id.in_(ids_ejercicios)
            )
        }

    # --- progreso por curso y global ---
    por_curso: dict = {c.id: [] for c in cursos}
    for e in ejercicios:
        por_curso[e.curso_id].append(e)

    filas_cursos = []
    for inscripcion in inscripciones:
        curso = inscripcion.curso
        lista = por_curso[curso.id]
        completados = sum(e.id in soluciones for e in lista)
        en_progreso = sum(e.id not in soluciones and e.id in progresos for e in lista)
        filas_cursos.append(ProgresoCursoEstudiante(
            curso_id=curso.id,
            curso_nombre=curso.nombre,
            fecha_inscripcion=inscripcion.fecha_inscripcion,
            total_ejercicios=len(lista),
            completados=completados,
            en_progreso=en_progreso,
            sin_iniciar=len(lista) - completados - en_progreso,
            porcentaje=_porcentaje(completados, len(lista)),
            entregas_con_feedback=sum(e.id in soluciones and bool(soluciones[e.id].feedback) for e in lista),
            revisados=sum(e.id in revisados for e in lista),
            ultima_actividad=_mayor(
                [soluciones[e.id].fecha_entrega for e in lista if e.id in soluciones]
                + [progresos[e.id].actualizado_en for e in lista if e.id in progresos]
            ),
        ))

    total = sum(f.total_ejercicios for f in filas_cursos)
    completados_total = sum(f.completados for f in filas_cursos)
    progreso = ProgresoGlobal(
        cursos=len(filas_cursos),
        total_ejercicios=total,
        completados=completados_total,
        en_progreso=sum(f.en_progreso for f in filas_cursos),
        sin_iniciar=sum(f.sin_iniciar for f in filas_cursos),
        porcentaje=_porcentaje(completados_total, total),
        entregas_con_feedback=sum(f.entregas_con_feedback for f in filas_cursos),
        revisados=sum(f.revisados for f in filas_cursos),
    )

    # --- uso de la herramienta de circuitos (solo agregados) ---
    sesiones = (
        db.query(Sesion.nombre, Sesion.fecha, Sesion.metricas)
        .filter(Sesion.usuario_id == estudiante.id)
        .order_by(Sesion.fecha.desc())
        .all()
    )
    tiempos = []
    for _, _, metricas in sesiones:
        valor = (metricas or {}).get("tiempo_total_segundos")
        if isinstance(valor, (int, float)):
            tiempos.append(float(valor))
    interacciones = (
        db.query(func.count(ChatMensaje.id))
        .join(Sesion, Sesion.id == ChatMensaje.sesion_id)
        .filter(Sesion.usuario_id == estudiante.id, ChatMensaje.rol == "user")
        .scalar()
        or 0
    )
    circuitos = ActividadCircuitos(
        sesiones=len(sesiones),
        sesiones_finalizadas=len(tiempos),
        tiempo_total_segundos=round(sum(tiempos), 1),
        tiempo_promedio_segundos=round(sum(tiempos) / len(tiempos), 1) if tiempos else None,
        interacciones_chat=interacciones,
        ultima_sesion=sesiones[0][1] if sesiones else None,
    )

    # --- actividad reciente: entregas, borradores y circuitos, lo más nuevo primero ---
    titulo_de = {e.id: e.titulo for e in ejercicios}
    curso_de = {e.id: nombre_curso[e.curso_id] for e in ejercicios}
    eventos = [
        EventoActividad(tipo="entrega", descripcion=f"Entregó «{titulo_de[eid]}»", curso_nombre=curso_de[eid], fecha=s.fecha_entrega)
        for eid, s in soluciones.items()
        if s.fecha_entrega
    ]
    eventos += [
        EventoActividad(tipo="borrador", descripcion=f"Trabajó en «{titulo_de[eid]}»", curso_nombre=curso_de[eid], fecha=p.actualizado_en)
        for eid, p in progresos.items()
        if eid not in soluciones and p.actualizado_en
    ]
    eventos += [
        EventoActividad(tipo="circuito", descripcion=f"Armó el circuito «{nombre}»", fecha=fecha)
        for nombre, fecha, _ in sesiones[:MAX_EVENTOS_RECIENTES]
        if fecha
    ]
    eventos.sort(key=lambda ev: ev.fecha, reverse=True)

    return MetricasEstudiante(
        perfil=PerfilEstudiante(
            estudiante_id=estudiante.id,
            nombre=estudiante.nombre,
            email=estudiante.email,
            nivel=estudiante.nivel,
            nivel_confirmado=bool(estudiante.nivel_confirmado),
            fecha_registro=estudiante.fecha_registro,
            ultimo_acceso=estudiante.ultimo_acceso,
            activo=estudiante.activo,
            desactivado_por_inactividad=bool(estudiante.desactivado_por_inactividad),
        ),
        progreso=progreso,
        cursos=filas_cursos,
        circuitos=circuitos,
        actividad_reciente=eventos[:MAX_EVENTOS_RECIENTES],
    )
