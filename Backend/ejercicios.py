"""Ejercicios de un curso — US17 eliminar ejercicio (#21), con imágenes en el
enunciado y soluciones de los estudiantes.

Permisos:
- Crear ejercicios y adjuntarles imágenes: SOLO el profesor que creó el curso.
- Eliminar un ejercicio o sus imágenes: ese profesor, o un administrador
  (mismo criterio que eliminar un curso, US11).
- Ver: además, los estudiantes inscritos en el curso (US13).
- Entregar una solución: solo un estudiante inscrito. Ver las soluciones de un
  ejercicio: el profesor del curso (todas) o el propio estudiante (la suya).
"""

from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.responses import Response
from sqlalchemy import func
from sqlalchemy.orm import Session

from archivos import leer_validado, nombre_seguro, tipo_de_imagen, tipo_de_imagen_o_pdf
from auth import obtener_usuario_actual
from cursos import esta_inscrito, gestiona_curso
from db.database import get_db
from db.models import Curso, Ejercicio, EjercicioImagen, Solucion, SolucionArchivo, Usuario
from rate_limit import verificar_frecuencia
from roles import ESTUDIANTE, PROFESOR
from schemas.ejercicios import (
    EjercicioCrear, EjercicioResponse, ImagenEjercicioResponse, SolucionResponse,
)

router = APIRouter(tags=["ejercicios"])

# Imágenes del enunciado.
MAX_IMAGENES_POR_EJERCICIO = 6
MAX_BYTES_IMAGEN = 3 * 1024 * 1024
# Archivos de una solución (imágenes o PDF).
MAX_ARCHIVOS_POR_SOLUCION = 5
MAX_BYTES_ARCHIVO_SOLUCION = 5 * 1024 * 1024
MAX_TEXTO_SOLUCION = 5000


def _curso_o_404(db: Session, curso_id: UUID) -> Curso:
    curso = db.get(Curso, curso_id)
    if curso is None:
        raise HTTPException(status_code=404, detail="Curso no encontrado.")
    return curso


def _es_profesor_del_curso(usuario: Usuario, curso: Curso) -> bool:
    return usuario.rol == PROFESOR and curso.creado_por == usuario.id


def _exigir_profesor_del_curso(usuario: Usuario, curso: Curso) -> None:
    if not _es_profesor_del_curso(usuario, curso):
        raise HTTPException(status_code=403, detail="Solo el profesor del curso puede crear ejercicios y adjuntarles imágenes.")


def _exigir_gestion(usuario: Usuario, curso: Curso) -> None:
    if not gestiona_curso(usuario, curso):
        raise HTTPException(status_code=403, detail="Solo el profesor del curso o un administrador puede gestionar sus ejercicios.")


def _puede_ver(db: Session, usuario: Usuario, curso: Curso) -> bool:
    return gestiona_curso(usuario, curso) or esta_inscrito(db, usuario, curso.id)


def _a_solucion_response(s: Solucion) -> SolucionResponse:
    return SolucionResponse(
        id=s.id,
        ejercicio_id=s.ejercicio_id,
        estudiante_id=s.estudiante_id,
        estudiante_nombre=s.estudiante.nombre,
        texto=s.texto,
        fecha_entrega=s.fecha_entrega,
        archivos=s.archivos,
    )


@router.get("/cursos/{curso_id}/ejercicios", response_model=list[EjercicioResponse])
def listar_ejercicios(
    curso_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    curso = _curso_o_404(db, curso_id)
    gestiona = gestiona_curso(usuario, curso)
    if not (gestiona or esta_inscrito(db, usuario, curso.id)):
        raise HTTPException(status_code=403, detail="Inscríbete en el curso para ver sus ejercicios.")

    ejercicios = (
        db.query(Ejercicio)
        .filter(Ejercicio.curso_id == curso.id)
        .order_by(Ejercicio.fecha_creacion, Ejercicio.id)
        .all()
    )
    respuestas = [EjercicioResponse.model_validate(e) for e in ejercicios]
    ids = [e.id for e in ejercicios]
    if not ids:
        return respuestas

    if gestiona:
        totales = dict(
            db.query(Solucion.ejercicio_id, func.count(Solucion.id))
            .filter(Solucion.ejercicio_id.in_(ids))
            .group_by(Solucion.ejercicio_id)
            .all()
        )
        for r in respuestas:
            r.total_soluciones = totales.get(r.id, 0)
    else:
        propias = {
            s.ejercicio_id: s
            for s in db.query(Solucion).filter(Solucion.ejercicio_id.in_(ids), Solucion.estudiante_id == usuario.id)
        }
        for r in respuestas:
            if r.id in propias:
                r.mi_solucion = _a_solucion_response(propias[r.id])
    return respuestas


@router.post("/cursos/{curso_id}/ejercicios", response_model=EjercicioResponse, status_code=201)
def crear_ejercicio(
    curso_id: UUID,
    datos: EjercicioCrear,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    verificar_frecuencia(f"user:{usuario.id}")
    curso = _curso_o_404(db, curso_id)
    _exigir_profesor_del_curso(usuario, curso)
    ejercicio = Ejercicio(curso_id=curso.id, titulo=datos.titulo, enunciado=datos.enunciado, creado_por=usuario.id)
    db.add(ejercicio)
    db.commit()
    db.refresh(ejercicio)
    respuesta = EjercicioResponse.model_validate(ejercicio)
    respuesta.total_soluciones = 0
    return respuesta


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


# ============================================================
#  Imágenes del enunciado
# ============================================================

@router.post("/ejercicios/{ejercicio_id}/imagenes", response_model=ImagenEjercicioResponse, status_code=201)
async def subir_imagen(
    ejercicio_id: UUID,
    archivo: UploadFile = File(...),
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    verificar_frecuencia(f"user:{usuario.id}")
    ejercicio = db.get(Ejercicio, ejercicio_id)
    if ejercicio is None:
        raise HTTPException(status_code=404, detail="El ejercicio no existe o ya fue eliminado.")
    _exigir_profesor_del_curso(usuario, ejercicio.curso)
    if len(ejercicio.imagenes) >= MAX_IMAGENES_POR_EJERCICIO:
        raise HTTPException(status_code=409, detail=f"Un ejercicio admite máximo {MAX_IMAGENES_POR_EJERCICIO} imágenes.")

    contenido, mime = await leer_validado(archivo, MAX_BYTES_IMAGEN, tipo_de_imagen)
    imagen = EjercicioImagen(
        ejercicio_id=ejercicio.id, nombre=nombre_seguro(archivo.filename, "imagen"),
        mime=mime, tamano=len(contenido), datos=contenido,
    )
    db.add(imagen)
    db.commit()
    db.refresh(imagen)
    return imagen


@router.get("/ejercicios/imagenes/{imagen_id}")
def obtener_imagen(
    imagen_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    imagen = db.get(EjercicioImagen, imagen_id)
    if imagen is None:
        raise HTTPException(status_code=404, detail="Imagen no encontrada.")
    ejercicio = db.get(Ejercicio, imagen.ejercicio_id)
    if not _puede_ver(db, usuario, ejercicio.curso):
        raise HTTPException(status_code=403, detail="Inscríbete en el curso para ver sus ejercicios.")
    return Response(
        content=imagen.datos,
        media_type=imagen.mime,
        headers={"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"},
    )


@router.delete("/ejercicios/imagenes/{imagen_id}", status_code=204)
def eliminar_imagen(
    imagen_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    imagen = db.get(EjercicioImagen, imagen_id)
    if imagen is None:
        raise HTTPException(status_code=404, detail="La imagen no existe o ya fue eliminada.")
    ejercicio = db.get(Ejercicio, imagen.ejercicio_id)
    _exigir_gestion(usuario, ejercicio.curso)
    db.delete(imagen)
    db.commit()


# ============================================================
#  Soluciones de los estudiantes
# ============================================================

@router.post("/ejercicios/{ejercicio_id}/solucion", response_model=SolucionResponse)
async def entregar_solucion(
    ejercicio_id: UUID,
    texto: str | None = Form(default=None),
    archivos: list[UploadFile] = File(default=[]),
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    """El estudiante inscrito entrega su solución: texto y/o archivos
    (imágenes o PDF). Volver a enviar REEMPLAZA la anterior por completo."""
    verificar_frecuencia(f"user:{usuario.id}")
    ejercicio = db.get(Ejercicio, ejercicio_id)
    if ejercicio is None:
        raise HTTPException(status_code=404, detail="El ejercicio no existe o ya fue eliminado.")
    if usuario.rol != ESTUDIANTE or not esta_inscrito(db, usuario, ejercicio.curso_id):
        raise HTTPException(status_code=403, detail="Solo los estudiantes inscritos en el curso pueden entregar soluciones.")

    texto = (texto or "").strip() or None
    if texto and len(texto) > MAX_TEXTO_SOLUCION:
        raise HTTPException(status_code=422, detail=f"La respuesta supera los {MAX_TEXTO_SOLUCION} caracteres.")
    # Un campo de archivos vacío llega como un UploadFile sin nombre.
    archivos = [a for a in archivos if a.filename]
    if len(archivos) > MAX_ARCHIVOS_POR_SOLUCION:
        raise HTTPException(status_code=409, detail=f"Máximo {MAX_ARCHIVOS_POR_SOLUCION} archivos por solución.")
    if not texto and not archivos:
        raise HTTPException(status_code=400, detail="Escribe una respuesta o adjunta al menos un archivo.")

    # Se valida TODO antes de tocar la base: si un archivo es inválido, la
    # solución anterior del estudiante queda intacta.
    validados = [await leer_validado(a, MAX_BYTES_ARCHIVO_SOLUCION, tipo_de_imagen_o_pdf) for a in archivos]

    solucion = (
        db.query(Solucion)
        .filter(Solucion.ejercicio_id == ejercicio.id, Solucion.estudiante_id == usuario.id)
        .first()
    )
    if solucion is None:
        solucion = Solucion(ejercicio_id=ejercicio.id, estudiante_id=usuario.id)
        db.add(solucion)
    solucion.texto = texto
    solucion.fecha_entrega = func.now()
    solucion.archivos = [
        SolucionArchivo(nombre=nombre_seguro(a.filename), mime=mime, tamano=len(contenido), datos=contenido)
        for a, (contenido, mime) in zip(archivos, validados)
    ]
    db.commit()
    db.refresh(solucion)
    return _a_solucion_response(solucion)


@router.delete("/ejercicios/{ejercicio_id}/solucion", status_code=204)
def retirar_solucion(
    ejercicio_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    solucion = (
        db.query(Solucion)
        .filter(Solucion.ejercicio_id == ejercicio_id, Solucion.estudiante_id == usuario.id)
        .first()
    )
    if solucion is None:
        raise HTTPException(status_code=404, detail="No tienes una solución entregada para este ejercicio.")
    db.delete(solucion)
    db.commit()


@router.get("/ejercicios/{ejercicio_id}/soluciones", response_model=list[SolucionResponse])
def listar_soluciones(
    ejercicio_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    """Las soluciones recibidas, de la más reciente a la más antigua. Solo
    quien gestiona el curso (el profesor, o un administrador)."""
    ejercicio = db.get(Ejercicio, ejercicio_id)
    if ejercicio is None:
        raise HTTPException(status_code=404, detail="El ejercicio no existe o ya fue eliminado.")
    _exigir_gestion(usuario, ejercicio.curso)
    soluciones = (
        db.query(Solucion)
        .filter(Solucion.ejercicio_id == ejercicio.id)
        .order_by(Solucion.fecha_entrega.desc(), Solucion.id)
        .all()
    )
    return [_a_solucion_response(s) for s in soluciones]


@router.get("/soluciones/archivos/{archivo_id}")
def obtener_archivo_solucion(
    archivo_id: UUID,
    usuario: Usuario = Depends(obtener_usuario_actual),
    db: Session = Depends(get_db),
):
    archivo = db.get(SolucionArchivo, archivo_id)
    if archivo is None:
        raise HTTPException(status_code=404, detail="Archivo no encontrado.")
    solucion = db.get(Solucion, archivo.solucion_id)
    ejercicio = db.get(Ejercicio, solucion.ejercicio_id)
    if not (solucion.estudiante_id == usuario.id or gestiona_curso(usuario, ejercicio.curso)):
        raise HTTPException(status_code=403, detail="No tienes acceso a este archivo.")
    # Los PDF se descargan (no se muestran dentro de nuestro origen); las
    # imágenes se muestran en línea.
    encabezados = {"X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=3600"}
    if archivo.mime == "application/pdf":
        nombre = archivo.nombre.replace('"', "")
        encabezados["Content-Disposition"] = f'attachment; filename="{nombre}"'
    return Response(content=archivo.datos, media_type=archivo.mime, headers=encabezados)
