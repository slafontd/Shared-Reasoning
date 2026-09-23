"""Cursos (US08 crear, #11 · US09 consultar, #12).

Router aparte de main.py para no seguir engordando ese archivo; se monta con
app.include_router(cursos.router).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from auth import obtener_usuario_actual
from db.database import get_db
from db.models import Curso, Usuario
from rate_limit import verificar_frecuencia
from schemas.cursos import CursoCrear, CursoResponse

router = APIRouter(prefix="/cursos", tags=["cursos"])


def a_respuesta(curso: Curso) -> CursoResponse:
    return CursoResponse(
        id=curso.id,
        nombre=curso.nombre,
        codigo=curso.codigo,
        descripcion=curso.descripcion,
        creado_por=curso.creado_por,
        creado_por_nombre=curso.creador.nombre,
        fecha_creacion=curso.fecha_creacion,
    )


@router.post("", response_model=CursoResponse, status_code=201)
def crear_curso(
    datos: CursoCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    verificar_frecuencia(f"user:{usuario.id}")
    curso = Curso(
        nombre=datos.nombre,
        codigo=datos.codigo,
        descripcion=datos.descripcion,
        creado_por=usuario.id,
    )
    db.add(curso)
    db.commit()
    db.refresh(curso)
    return a_respuesta(curso)
