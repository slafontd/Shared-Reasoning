"""Gestión de usuarios por administrador.

Router aparte de main.py, mismo patrón que cursos.py: se monta con
app.include_router(admin.router). Todas las rutas exigen es_admin=True — la
dependencia se declara una sola vez a nivel de router (`dependencies=`) en vez
de repetirla en cada endpoint, así ninguna ruta nueva que se agregue acá puede
olvidarse de restringirla.
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from auth import hashear_contrasena, requerir_admin
from db.database import get_db
from db.models import Usuario
from schemas.admin import AdminUsuarioActualizar, AdminUsuarioCrear, AdminUsuarioResponse

router = APIRouter(prefix="/admin/usuarios", tags=["admin"], dependencies=[Depends(requerir_admin)])


def _buscar_por_email(db: Session, email: str, excluir_id: UUID | None = None) -> Usuario | None:
    consulta = db.query(Usuario).filter(func.lower(Usuario.email) == email.lower())
    if excluir_id is not None:
        consulta = consulta.filter(Usuario.id != excluir_id)
    return consulta.first()


@router.get("", response_model=list[AdminUsuarioResponse])
def listar_usuarios(
    busqueda: str | None = Query(default=None, max_length=100, description="Filtra por nombre o correo."),
    limite: int = Query(default=50, ge=1, le=200),
    desplazamiento: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    consulta = db.query(Usuario)
    termino = (busqueda or "").strip()
    if termino:
        patron = f"%{termino.lower()}%"
        consulta = consulta.filter(
            or_(func.lower(Usuario.nombre).like(patron), func.lower(Usuario.email).like(patron))
        )
    usuarios = (
        consulta.order_by(Usuario.fecha_registro.desc())
        .offset(desplazamiento)
        .limit(limite)
        .all()
    )
    return usuarios


@router.post("", response_model=AdminUsuarioResponse, status_code=201)
def crear_usuario(datos: AdminUsuarioCrear, db: Session = Depends(get_db)):
    if _buscar_por_email(db, datos.email):
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con este email.")

    usuario = Usuario(
        nombre=datos.nombre,
        email=datos.email,
        contrasena_hash=hashear_contrasena(datos.contrasena),
        nivel=datos.nivel,
        nivel_confirmado=True,  # lo crea un admin, no pasa por la encuesta de nivel
        es_admin=datos.es_admin,
        # Verificación de correo (ver auth.py): un admin ya está dando fe de la
        # cuenta al crearla a mano, así que no tiene sentido pedirle además que
        # confirme un código que este endpoint ni siquiera genera — de lo
        # contrario la cuenta quedaría creada pero sin forma de iniciar sesión.
        email_verificado=True,
    )
    db.add(usuario)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con este email.")
    db.refresh(usuario)
    return usuario


@router.patch("/{usuario_id}", response_model=AdminUsuarioResponse)
def actualizar_usuario(
    usuario_id: UUID,
    datos: AdminUsuarioActualizar,
    admin: Usuario = Depends(requerir_admin),
    db: Session = Depends(get_db),
):
    destino = db.get(Usuario, usuario_id)
    if destino is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    # Un admin no puede desactivarse ni quitarse el rol a sí mismo: si es el
    # único admin activo, se quedaría sin forma de revertirlo (no hay bypass
    # ni acceso directo a la BD contemplado en este flujo).
    if destino.id == admin.id:
        if datos.activo is False:
            raise HTTPException(status_code=400, detail="No puedes desactivar tu propia cuenta.")
        if datos.es_admin is False:
            raise HTTPException(status_code=400, detail="No puedes quitarte a ti mismo el rol de administrador.")

    if datos.nombre is not None:
        destino.nombre = datos.nombre
    if datos.email is not None and datos.email != destino.email:
        if _buscar_por_email(db, datos.email, excluir_id=destino.id):
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con este email.")
        destino.email = datos.email
    if datos.nivel is not None:
        destino.nivel = datos.nivel
    if datos.es_admin is not None:
        destino.es_admin = datos.es_admin
    if datos.activo is not None:
        destino.activo = datos.activo

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con este email.")
    db.refresh(destino)
    return destino


@router.delete("/{usuario_id}", status_code=204)
def eliminar_usuario(
    usuario_id: UUID,
    admin: Usuario = Depends(requerir_admin),
    db: Session = Depends(get_db),
):
    if usuario_id == admin.id:
        raise HTTPException(status_code=400, detail="No puedes eliminar tu propia cuenta.")

    destino = db.get(Usuario, usuario_id)
    if destino is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    # Cascada ya declarada en el modelo (ondelete="CASCADE"): se van con él
    # sus sesiones, materiales subidos y cursos creados.
    db.delete(destino)
    db.commit()
