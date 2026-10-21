"""Ejercicios de un curso — US17 eliminar ejercicio (#21).

Incluye la base mínima que US17 necesita para tener algo que eliminar:
crear y listar ejercicios de un curso. US14 (crear ejercicio) y US15
(consultar ejercicios) deben construir sobre esto en vez de duplicarlo.

Permisos (mismo criterio que eliminar un curso, US11):
- Crear y eliminar: el profesor que creó el curso, o un administrador.
- Ver: además, los estudiantes inscritos en el curso (US13).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from auth import obtener_usuario_actual
from cursos import esta_inscrito, gestiona_curso
from db.database import get_db
from db.models import Curso, Ejercicio, Usuario
from rate_limit import verificar_frecuencia
from schemas.ejercicios import EjercicioCrear, EjercicioResponse

router = APIRouter(tags=["ejercicios"])


def _curso_o_404(db: Session, curso_id: UUID) -> Curso:
    curso = db.get(Curso, curso_id)
    if curso is None:
        raise HTTPException(status_code=404, detail="Curso no encontrado.")
    return curso


def _exigir_gestion(usuario: Usuario, curso: Curso) -> None:
    if not gestiona_curso(usuario, curso):
        raise HTTPException(status_code=403, detail="Solo el profesor del curso o un administrador puede gestionar sus ejercicios.")


@router.get("/cursos/{curso_id}/ejercicios", response_model=list[EjercicioResponse])
def listar_ejercicios(
    curso_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    curso = _curso_o_404(db, curso_id)
    if not (gestiona_curso(usuario, curso) or esta_inscrito(db, usuario, curso.id)):
        raise HTTPException(status_code=403, detail="Inscríbete en el curso para ver sus ejercicios.")
    return (
        db.query(Ejercicio)
        .filter(Ejercicio.curso_id == curso.id)
        .order_by(Ejercicio.fecha_creacion, Ejercicio.id)
        .all()
    )


@router.post("/cursos/{curso_id}/ejercicios", response_model=EjercicioResponse, status_code=201)
def crear_ejercicio(
    curso_id: UUID,
    datos: EjercicioCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    verificar_frecuencia(f"user:{usuario.id}")
    curso = _curso_o_404(db, curso_id)
    _exigir_gestion(usuario, curso)
    ejercicio = Ejercicio(curso_id=curso.id, titulo=datos.titulo, enunciado=datos.enunciado, creado_por=usuario.id)
    db.add(ejercicio)
    db.commit()
    db.refresh(ejercicio)
    return ejercicio


@router.delete("/ejercicios/{ejercicio_id}", status_code=204)
def eliminar_ejercicio(
    ejercicio_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    """US17 (#21): el ejercicio deja de estar disponible de inmediato para
    todos (estudiantes inscritos incluidos). La confirmación la pide el
    frontend antes de llamar a este endpoint."""
    ejercicio = db.get(Ejercicio, ejercicio_id)
    if ejercicio is None:
        raise HTTPException(status_code=404, detail="El ejercicio no existe o ya fue eliminado.")
    _exigir_gestion(usuario, ejercicio.curso)
    db.delete(ejercicio)
    db.commit()
