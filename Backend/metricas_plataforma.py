"""Métricas de la plataforma — EP07: US26 dashboard (#33), US27 por profesor
(#34) y US28 por curso (#35).

Nombre distinto de metricas.py, que mide el consumo de tokens/costo de los
modelos de IA: esto mide el uso académico (cursos, inscripciones, entregas y
feedback).

Quién ve qué:
- Administrador: toda la plataforma, todos los profesores y todos los cursos.
- Profesor: solo sus propios cursos (y su propio resumen).
- Estudiante: nada (403).

Todo se calcula con consultas agregadas (COUNT/GROUP BY) en la BD — una por
tipo de dato, no una por curso — para que el dashboard siga siendo rápido
con muchos cursos.
"""

from datetime import timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import distinct, func
from sqlalchemy.orm import Session

from auth import requerir_rol
from db.database import get_db
from db.models import Curso, Ejercicio, Inscripcion, Solucion, Usuario
from inactividad import ahora
from roles import ADMINISTRADOR, PROFESOR, ROLES_VALIDOS
from schemas.metricas import (
    DetalleMetricasCurso,
    MetricasCurso,
    MetricasEjercicio,
    MetricasProfesor,
    ResumenMetricas,
)

router = APIRouter(prefix="/metricas", tags=["metricas"])
solo_docentes = requerir_rol(ADMINISTRADOR, PROFESOR)


def _porcentaje(parte: int, total: int) -> int:
    return round(parte / total * 100) if total else 0


def _totales_entregas(entregas: int, con_feedback: int) -> dict:
    return {
        "entregas": entregas,
        "con_feedback": con_feedback,
        "sin_feedback": entregas - con_feedback,
        "tasa_feedback": _porcentaje(con_feedback, entregas),
    }


def _cursos_visibles(db: Session, usuario: Usuario) -> list[Curso]:
    consulta = db.query(Curso)
    if usuario.rol != ADMINISTRADOR:
        consulta = consulta.filter(Curso.creado_por == usuario.id)
    return consulta.order_by(Curso.fecha_creacion.desc(), Curso.id).all()


def _conteos_por_curso(db: Session, ids: list) -> tuple[dict, dict, dict]:
    """(inscritos, ejercicios, entregas) por curso_id, en 3 consultas.
    entregas[curso_id] = (total, con_feedback, ultima_fecha)."""
    if not ids:
        return {}, {}, {}
    inscritos = dict(
        db.query(Inscripcion.curso_id, func.count(Inscripcion.id))
        .filter(Inscripcion.curso_id.in_(ids))
        .group_by(Inscripcion.curso_id)
        .all()
    )
    ejercicios = dict(
        db.query(Ejercicio.curso_id, func.count(Ejercicio.id))
        .filter(Ejercicio.curso_id.in_(ids))
        .group_by(Ejercicio.curso_id)
        .all()
    )
    entregas = {
        curso_id: (total, con_feedback, ultima)
        for curso_id, total, con_feedback, ultima in (
            db.query(
                Ejercicio.curso_id,
                func.count(Solucion.id),
                func.count(Solucion.feedback),  # COUNT ignora NULL = sin feedback
                func.max(Solucion.fecha_entrega),
            )
            .join(Ejercicio, Solucion.ejercicio_id == Ejercicio.id)
            .filter(Ejercicio.curso_id.in_(ids))
            .group_by(Ejercicio.curso_id)
            .all()
        )
    }
    return inscritos, ejercicios, entregas


def _metricas_curso(curso: Curso, inscritos: dict, ejercicios: dict, entregas: dict) -> dict:
    n_inscritos = inscritos.get(curso.id, 0)
    n_ejercicios = ejercicios.get(curso.id, 0)
    total, con_feedback, ultima = entregas.get(curso.id, (0, 0, None))
    return {
        "curso_id": curso.id,
        "nombre": curso.nombre,
        "codigo": curso.codigo,
        "profesor_nombre": curso.creador.nombre,
        "inscritos": n_inscritos,
        "ejercicios": n_ejercicios,
        "tasa_entrega": _porcentaje(total, n_inscritos * n_ejercicios),
        "ultima_entrega": ultima,
        **_totales_entregas(total, con_feedback),
    }


@router.get("/resumen", response_model=ResumenMetricas)
def resumen(usuario: Usuario = Depends(solo_docentes), db: Session = Depends(get_db)):
    """US26 (#33): los números del dashboard."""
    cursos = _cursos_visibles(db, usuario)
    ids = [c.id for c in cursos]
    inscritos, ejercicios, entregas = _conteos_por_curso(db, ids)
    total_entregas = sum(e[0] for e in entregas.values())
    total_feedback = sum(e[1] for e in entregas.values())
    estudiantes = (
        db.query(func.count(distinct(Inscripcion.usuario_id))).filter(Inscripcion.curso_id.in_(ids)).scalar()
        if ids else 0
    )
    datos = {
        "alcance": "plataforma" if usuario.rol == ADMINISTRADOR else "profesor",
        "cursos": len(cursos),
        "estudiantes": estudiantes,
        "inscripciones": sum(inscritos.values()),
        "ejercicios": sum(ejercicios.values()),
        **_totales_entregas(total_entregas, total_feedback),
    }
    if usuario.rol == ADMINISTRADOR:
        por_rol = dict(db.query(Usuario.rol, func.count(Usuario.id)).group_by(Usuario.rol).all())
        momento = ahora()

        def activos_desde(dias: int) -> int:
            return (
                db.query(func.count(Usuario.id))
                .filter(Usuario.activo.is_(True), Usuario.ultimo_acceso >= momento - timedelta(days=dias))
                .scalar()
            )

        datos.update(
            usuarios_total=sum(por_rol.values()),
            usuarios_por_rol={rol: por_rol.get(rol, 0) for rol in sorted(ROLES_VALIDOS)},
            activos_7_dias=activos_desde(7),
            activos_30_dias=activos_desde(30),
            desactivados=db.query(func.count(Usuario.id)).filter(Usuario.activo.is_(False)).scalar(),
        )
    return ResumenMetricas(**datos)


@router.get("/profesores", response_model=list[MetricasProfesor])
def metricas_por_profesor(usuario: Usuario = Depends(solo_docentes), db: Session = Depends(get_db)):
    """US27 (#34): una fila por profesor. El administrador ve a todos (los
    que tienen rol profesor o han creado cursos); un profesor, solo su fila."""
    if usuario.rol == ADMINISTRADOR:
        creadores = {fila[0] for fila in db.query(distinct(Curso.creado_por)).all()}
        profesores = (
            db.query(Usuario)
            .filter((Usuario.rol == PROFESOR) | (Usuario.id.in_(creadores)))
            .order_by(Usuario.nombre)
            .all()
        )
    else:
        profesores = [usuario]

    ids_profes = [p.id for p in profesores]
    cursos = db.query(Curso).filter(Curso.creado_por.in_(ids_profes)).all() if ids_profes else []
    inscritos, ejercicios, entregas = _conteos_por_curso(db, [c.id for c in cursos])
    estudiantes = dict(
        db.query(Curso.creado_por, func.count(distinct(Inscripcion.usuario_id)))
        .join(Inscripcion, Inscripcion.curso_id == Curso.id)
        .filter(Curso.creado_por.in_(ids_profes))
        .group_by(Curso.creado_por)
        .all()
    ) if ids_profes else {}

    filas = []
    for profe in profesores:
        suyos = [c for c in cursos if c.creado_por == profe.id]
        total = sum(entregas.get(c.id, (0, 0, None))[0] for c in suyos)
        con_feedback = sum(entregas.get(c.id, (0, 0, None))[1] for c in suyos)
        filas.append(MetricasProfesor(
            profesor_id=profe.id,
            nombre=profe.nombre,
            email=profe.email,
            cursos=len(suyos),
            estudiantes=estudiantes.get(profe.id, 0),
            ejercicios=sum(ejercicios.get(c.id, 0) for c in suyos),
            ultimo_acceso=profe.ultimo_acceso,
            **_totales_entregas(total, con_feedback),
        ))
    return filas


@router.get("/cursos", response_model=list[MetricasCurso])
def metricas_por_curso(usuario: Usuario = Depends(solo_docentes), db: Session = Depends(get_db)):
    """US28 (#35): una fila por curso visible (todos para el admin, los
    propios para un profesor)."""
    cursos = _cursos_visibles(db, usuario)
    inscritos, ejercicios, entregas = _conteos_por_curso(db, [c.id for c in cursos])
    return [MetricasCurso(**_metricas_curso(c, inscritos, ejercicios, entregas)) for c in cursos]


@router.get("/cursos/{curso_id}", response_model=DetalleMetricasCurso)
def detalle_metricas_curso(
    curso_id: UUID,
    usuario: Usuario = Depends(solo_docentes),
    db: Session = Depends(get_db),
):
    """US28 (#35): las métricas de un curso con el desglose por ejercicio."""
    curso = db.get(Curso, curso_id)
    if curso is None:
        raise HTTPException(status_code=404, detail="Curso no encontrado.")
    if usuario.rol != ADMINISTRADOR and curso.creado_por != usuario.id:
        raise HTTPException(status_code=403, detail="Solo puedes ver las métricas de tus propios cursos.")

    inscritos, ejercicios, entregas = _conteos_por_curso(db, [curso.id])
    n_inscritos = inscritos.get(curso.id, 0)
    por_ejercicio_db = {
        ejercicio_id: (total, con_feedback)
        for ejercicio_id, total, con_feedback in (
            db.query(Solucion.ejercicio_id, func.count(Solucion.id), func.count(Solucion.feedback))
            .join(Ejercicio, Solucion.ejercicio_id == Ejercicio.id)
            .filter(Ejercicio.curso_id == curso.id)
            .group_by(Solucion.ejercicio_id)
            .all()
        )
    }
    lista_ejercicios = (
        db.query(Ejercicio).filter(Ejercicio.curso_id == curso.id).order_by(Ejercicio.fecha_creacion, Ejercicio.id).all()
    )
    por_ejercicio = []
    for ejercicio in lista_ejercicios:
        total, con_feedback = por_ejercicio_db.get(ejercicio.id, (0, 0))
        por_ejercicio.append(MetricasEjercicio(
            ejercicio_id=ejercicio.id,
            titulo=ejercicio.titulo,
            tasa_entrega=_porcentaje(total, n_inscritos),
            **_totales_entregas(total, con_feedback),
        ))
    return DetalleMetricasCurso(**_metricas_curso(curso, inscritos, ejercicios, entregas), por_ejercicio=por_ejercicio)
