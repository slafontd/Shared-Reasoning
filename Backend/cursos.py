"""Cursos (US08 crear, #11 · US09 consultar, #12).

Router aparte de main.py para no seguir engordando ese archivo; se monta con
app.include_router(cursos.router).
"""

import unicodedata
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from auth import obtener_usuario_actual
from db.database import get_db
from db.models import Curso, Usuario
from rate_limit import verificar_frecuencia
from schemas.cursos import CursoCrear, CursoResponse

router = APIRouter(prefix="/cursos", tags=["cursos"])

# Búsqueda sin tildes: "electrica" encuentra "Eléctrica". Se hace con
# translate() de Postgres en vez de la extensión unaccent para no depender de
# que esté instalada en la base.
# Incluye mayúsculas acentuadas: con collation "C" lower('É') no las baja.
_CON_TILDE = "áéíóúüñàèìòùÁÉÍÓÚÜÑÀÈÌÒÙ"
_SIN_TILDE = "aeiouunaeiouaeiouunaeiou"


def _sin_tildes_sql(columna):
    return func.translate(func.lower(columna), _CON_TILDE, _SIN_TILDE)


def _sin_tildes(texto: str) -> str:
    descompuesto = unicodedata.normalize("NFD", texto.lower())
    return "".join(c for c in descompuesto if unicodedata.category(c) != "Mn")


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


@router.get("", response_model=list[CursoResponse])
def listar_cursos(
    busqueda: str | None = Query(default=None, max_length=100, description="Filtra por nombre o código (sin distinguir mayúsculas ni tildes)."),
    limite: int = Query(default=50, ge=1, le=100),
    desplazamiento: int = Query(default=0, ge=0),
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    """Cursos disponibles, del más reciente al más antiguo (US09, #12).
    Paginado con limite/desplazamiento para no traer la tabla entera."""
    consulta = db.query(Curso)
    termino = (busqueda or "").strip()
    if termino:
        # Se escapan los comodines de LIKE para que "%" o "_" se busquen literal.
        escapado = _sin_tildes(termino).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        patron = f"%{escapado}%"
        consulta = consulta.filter(
            or_(
                _sin_tildes_sql(Curso.nombre).like(patron, escape="\\"),
                _sin_tildes_sql(Curso.codigo).like(patron, escape="\\"),
            )
        )
    cursos = (
        consulta.order_by(Curso.fecha_creacion.desc(), Curso.id)
        .offset(desplazamiento)
        .limit(limite)
        .all()
    )
    return [a_respuesta(c) for c in cursos]


@router.get("/{curso_id}", response_model=CursoResponse)
def obtener_curso(
    curso_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    curso = db.get(Curso, curso_id)
    if curso is None:
        raise HTTPException(status_code=404, detail="Curso no encontrado.")
    return a_respuesta(curso)
