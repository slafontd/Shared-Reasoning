"""Cursos (US08 crear, #11 · US09 consultar, #12 · US11 eliminar · US12 buscar por código, #15 · US13 inscribirse, #16).

Router aparte de main.py para no seguir engordando ese archivo; se monta con
app.include_router(cursos.router).
"""

import unicodedata
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import obtener_usuario_actual, requerir_rol
from codigos_curso import normalizar_codigo, nuevo_codigo_unico
from db.database import get_db
from db.models import Curso, Inscripcion, Usuario
from rate_limit import verificar_frecuencia
from roles import ADMINISTRADOR, ESTUDIANTE, PROFESOR
from schemas.cursos import CursoCrear, CursoResponse, InscripcionCrear

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


def gestiona_curso(usuario: Usuario, curso: Curso) -> bool:
    """Quién administra un curso: su creador o un administrador (mismo
    criterio que eliminar_curso, US11)."""
    return usuario.rol == ADMINISTRADOR or curso.creado_por == usuario.id


def esta_inscrito(db: Session, usuario: Usuario, curso_id) -> bool:
    return (
        db.query(Inscripcion.id)
        .filter(Inscripcion.usuario_id == usuario.id, Inscripcion.curso_id == curso_id)
        .first()
        is not None
    )


def a_respuesta(curso: Curso, usuario: Usuario, inscrito: bool = False) -> CursoResponse:
    return CursoResponse(
        id=curso.id,
        nombre=curso.nombre,
        codigo=curso.codigo,
        descripcion=curso.descripcion,
        creado_por=curso.creado_por,
        creado_por_nombre=curso.creador.nombre,
        fecha_creacion=curso.fecha_creacion,
        codigo_acceso=curso.codigo_acceso if gestiona_curso(usuario, curso) else None,
        inscrito=inscrito,
    )


@router.post("", response_model=CursoResponse, status_code=201)
def crear_curso(
    datos: CursoCrear,
    # US06: crear un curso es una acción de docencia, no de cualquier
    # usuario autenticado — resuelve el "decidirá más adelante" que dejó
    # pendiente el modelo Curso (db/models.py) cuando todavía no existían roles.
    usuario: Usuario = Depends(requerir_rol(ADMINISTRADOR, PROFESOR)),
    db: Session = Depends(get_db),
):
    verificar_frecuencia(f"user:{usuario.id}")
    curso = Curso(
        nombre=datos.nombre,
        codigo=datos.codigo,
        descripcion=datos.descripcion,
        creado_por=usuario.id,
        codigo_acceso=nuevo_codigo_unico(
            lambda c: db.query(Curso.id).filter(Curso.codigo_acceso == c).first() is not None
        ),
    )
    db.add(curso)
    db.commit()
    db.refresh(curso)
    return a_respuesta(curso, usuario)


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
    ids_inscritos = {
        fila.curso_id
        for fila in db.query(Inscripcion.curso_id).filter(
            Inscripcion.usuario_id == usuario.id,
            Inscripcion.curso_id.in_([c.id for c in cursos]),
        )
    }
    return [a_respuesta(c, usuario, c.id in ids_inscritos) for c in cursos]


@router.get("/codigo/{codigo}", response_model=CursoResponse)
def buscar_por_codigo(
    codigo: str,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    """US12 (#15): el estudiante escribe el código que le compartió su
    profesor y ve el curso antes de inscribirse. Se aceptan minúsculas,
    espacios y guiones ("k7p2-qx" encuentra "K7P2QX")."""
    normalizado = normalizar_codigo(codigo)
    curso = (
        db.query(Curso).filter(Curso.codigo_acceso == normalizado).first()
        if 4 <= len(normalizado) <= 12
        else None
    )
    if curso is None:
        raise HTTPException(status_code=404, detail="No existe ningún curso con ese código. Revisa que esté bien escrito.")
    return a_respuesta(curso, usuario, esta_inscrito(db, usuario, curso.id))


@router.post("/inscripciones", response_model=CursoResponse, status_code=201)
def inscribirse(
    datos: InscripcionCrear,
    # US13 (#16): "como estudiante, quiero inscribirme". Un profesor o un
    # administrador no se inscribe a cursos: los crea o los administra.
    usuario: Usuario = Depends(requerir_rol(ESTUDIANTE)),
    db: Session = Depends(get_db),
):
    verificar_frecuencia(f"user:{usuario.id}")
    curso = db.query(Curso).filter(Curso.codigo_acceso == normalizar_codigo(datos.codigo)).first()
    if curso is None:
        raise HTTPException(status_code=404, detail="No existe ningún curso con ese código. Revisa que esté bien escrito.")
    if esta_inscrito(db, usuario, curso.id):
        raise HTTPException(status_code=409, detail="Ya estás inscrito en este curso.")

    db.add(Inscripcion(usuario_id=usuario.id, curso_id=curso.id))
    try:
        db.commit()
    except IntegrityError:
        # Doble clic / dos pestañas: la restricción única de la BD es la garantía final.
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya estás inscrito en este curso.")
    return a_respuesta(curso, usuario, inscrito=True)


@router.get("/mis-cursos", response_model=list[CursoResponse])
def mis_cursos(
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    """US13 (#16): los cursos en los que está inscrito el usuario, del más
    reciente al más antiguo según la fecha de inscripción. Debe declararse
    ANTES de /{curso_id}: si no, "mis-cursos" se intentaría leer como UUID."""
    inscripciones = (
        db.query(Inscripcion)
        .filter(Inscripcion.usuario_id == usuario.id)
        .order_by(Inscripcion.fecha_inscripcion.desc(), Inscripcion.id)
        .all()
    )
    return [a_respuesta(i.curso, usuario, inscrito=True) for i in inscripciones]


@router.get("/{curso_id}", response_model=CursoResponse)
def obtener_curso(
    curso_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    curso = db.get(Curso, curso_id)
    if curso is None:
        raise HTTPException(status_code=404, detail="Curso no encontrado.")
    return a_respuesta(curso, usuario, esta_inscrito(db, usuario, curso.id))


@router.delete("/{curso_id}", status_code=204)
def eliminar_curso(
    curso_id: UUID,
    # Mismo permiso base que crear (US06): un estudiante no llega ni a este
    # punto. Dentro de eso, un profesor solo puede eliminar los cursos que
    # él mismo creó — un administrador puede eliminar cualquiera (US11, #14).
    usuario: Usuario = Depends(requerir_rol(ADMINISTRADOR, PROFESOR)),
    db: Session = Depends(get_db),
):
    curso = db.get(Curso, curso_id)
    if curso is None:
        raise HTTPException(status_code=404, detail="Curso no encontrado.")
    if usuario.rol == PROFESOR and curso.creado_por != usuario.id:
        raise HTTPException(status_code=403, detail="Solo puedes eliminar los cursos que tú creaste.")

    db.delete(curso)
    db.commit()
