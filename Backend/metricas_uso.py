"""Frecuencia de uso e interacciones de los usuarios — US30.

Solo para administradores. Se calcula sobre `eventos_actividad` (ver
actividad.py): el administrador ve cuánto se usa la plataforma, qué hacen los
usuarios y con qué frecuencia, para toda la plataforma o por usuario.

Los días y las horas se cuentan en la zona horaria de la plataforma
(ZONA_HORARIA en el .env, por defecto America/Bogota), no en UTC: así "hoy" y
"las 8 pm" significan lo que esperan los usuarios.
"""

import os
from datetime import date, datetime, timedelta, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import and_, case, distinct, func, or_
from sqlalchemy.orm import Session

from actividad import ETIQUETAS, INICIO_SESION, INTERACCIONES
from auth import requerir_rol
from db.database import get_db
from db.models import EventoActividad, Usuario
from roles import ADMINISTRADOR, ROLES_VALIDOS
from schemas.metricas_uso import (
    DetalleUsoUsuario, EventoReciente, ListaUsoUsuarios, PeriodoUso, PuntoDiario, ResumenUso,
    TotalPorTipo, UsoDeUsuario, UsoPlataforma, UsoPorHora, UsoPorRol,
)

router = APIRouter(prefix="/metricas/uso", tags=["metricas"])
solo_admin = requerir_rol(ADMINISTRADOR)

ZONA_HORARIA = os.getenv("ZONA_HORARIA", "America/Bogota")
DIAS_MIN, DIAS_MAX, DIAS_POR_DEFECTO = 7, 365, 30
ORDENES = ("interacciones", "dias_activos", "ultima_actividad", "nombre")

_local = func.timezone(ZONA_HORARIA, EventoActividad.fecha)
_dia = func.date(_local)
_es_interaccion = EventoActividad.tipo.in_(INTERACCIONES)


def _periodo(db: Session, dias: int) -> PeriodoUso:
    hoy = db.query(func.date(func.timezone(ZONA_HORARIA, func.now()))).scalar()
    return PeriodoUso(dias=dias, desde=hoy - timedelta(days=dias - 1), hasta=hoy, zona_horaria=ZONA_HORARIA)


def _en_periodo(periodo: PeriodoUso):
    """Condición sobre eventos. El primer término usa el índice de `fecha`; el
    segundo recorta exactamente a los días locales del periodo."""
    margen = datetime.now(timezone.utc) - timedelta(days=periodo.dias + 1)
    return and_(EventoActividad.fecha >= margen, _dia >= periodo.desde, _dia <= periodo.hasta)


def _porcentaje(parte: int, total: int) -> int:
    return round(parte / total * 100) if total else 0


def _serie(db: Session, periodo: PeriodoUso, usuario_id: UUID | None = None) -> list[PuntoDiario]:
    consulta = (
        db.query(
            _dia.label("dia"),
            func.count(case((_es_interaccion, 1))).label("interacciones"),
            func.count(case((EventoActividad.tipo == INICIO_SESION, 1))).label("inicios"),
            func.count(distinct(EventoActividad.usuario_id)).label("usuarios"),
        )
        .filter(_en_periodo(periodo))
        .group_by("dia")
    )
    if usuario_id is not None:
        consulta = consulta.filter(EventoActividad.usuario_id == usuario_id)
    por_dia = {fila.dia: fila for fila in consulta}
    serie = []
    for i in range(periodo.dias):
        d = periodo.desde + timedelta(days=i)
        fila = por_dia.get(d)
        serie.append(PuntoDiario(
            fecha=d,
            interacciones=fila.interacciones if fila else 0,
            inicios_sesion=fila.inicios if fila else 0,
            usuarios_activos=fila.usuarios if fila else 0,
        ))
    return serie


def _por_tipo(db: Session, periodo: PeriodoUso, usuario_id: UUID | None = None) -> list[TotalPorTipo]:
    consulta = db.query(EventoActividad.tipo, func.count()).filter(_en_periodo(periodo)).group_by(EventoActividad.tipo)
    if usuario_id is not None:
        consulta = consulta.filter(EventoActividad.usuario_id == usuario_id)
    totales = dict(consulta.all())
    filas = [
        TotalPorTipo(tipo=t, etiqueta=ETIQUETAS[t], total=totales.get(t, 0), es_interaccion=t in INTERACCIONES)
        for t in ETIQUETAS
    ]
    return sorted(filas, key=lambda f: (-f.total, f.etiqueta))


def _fila_usuario(usuario: Usuario, interacciones, inicios, dias_activos, ultima, dias: int) -> UsoDeUsuario:
    return UsoDeUsuario(
        usuario_id=usuario.id,
        nombre=usuario.nombre,
        email=usuario.email,
        rol=usuario.rol,
        interacciones=interacciones or 0,
        inicios_sesion=inicios or 0,
        dias_activos=dias_activos or 0,
        frecuencia=_porcentaje(dias_activos or 0, dias),
        ultima_actividad=ultima,
    )


@router.get("", response_model=UsoPlataforma)
def uso_de_la_plataforma(
    dias: int = Query(DIAS_POR_DEFECTO, ge=DIAS_MIN, le=DIAS_MAX),
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    periodo = _periodo(db, dias)
    en_periodo = _en_periodo(periodo)

    eventos, interacciones, inicios, activos = db.query(
        func.count(),
        func.count(case((_es_interaccion, 1))),
        func.count(case((EventoActividad.tipo == INICIO_SESION, 1))),
        func.count(distinct(EventoActividad.usuario_id)),
    ).filter(en_periodo).one()

    usuarios_totales = db.query(func.count(Usuario.id)).filter(Usuario.activo.is_(True)).scalar() or 0
    dias_por_usuario = (
        db.query(func.count(distinct(_dia)).label("dias"))
        .filter(en_periodo)
        .group_by(EventoActividad.usuario_id)
        .subquery()
    )
    promedio_dias = db.query(func.avg(dias_por_usuario.c.dias)).scalar()

    por_rol = [
        UsoPorRol(rol=rol, usuarios_activos=n_usuarios, interacciones=n_inter)
        for rol, n_usuarios, n_inter in (
            db.query(
                Usuario.rol,
                func.count(distinct(EventoActividad.usuario_id)),
                func.count(case((_es_interaccion, 1))),
            )
            .join(Usuario, Usuario.id == EventoActividad.usuario_id)
            .filter(en_periodo)
            .group_by(Usuario.rol)
            .all()
        )
    ]
    por_rol.sort(key=lambda r: (-r.interacciones, r.rol))

    por_hora_db = dict(
        db.query(func.extract("hour", _local).label("hora"), func.count())
        .filter(en_periodo)
        .group_by("hora")
        .all()
    )

    return UsoPlataforma(
        periodo=periodo,
        resumen=ResumenUso(
            eventos=eventos,
            interacciones=interacciones,
            inicios_sesion=inicios,
            usuarios_activos=activos,
            usuarios_totales=usuarios_totales,
            porcentaje_activos=_porcentaje(activos, usuarios_totales),
            promedio_interacciones_por_usuario=round(interacciones / activos, 1) if activos else 0.0,
            promedio_dias_activos=round(float(promedio_dias), 1) if promedio_dias is not None else 0.0,
        ),
        serie_diaria=_serie(db, periodo),
        por_tipo=_por_tipo(db, periodo),
        por_rol=por_rol,
        por_hora=[UsoPorHora(hora=h, eventos=int(por_hora_db.get(h, 0))) for h in range(24)],
    )


@router.get("/usuarios", response_model=ListaUsoUsuarios)
def uso_por_usuario(
    dias: int = Query(DIAS_POR_DEFECTO, ge=DIAS_MIN, le=DIAS_MAX),
    rol: str | None = Query(None),
    buscar: str | None = Query(None, max_length=100),
    orden: str = Query("interacciones"),
    limite: int = Query(50, ge=1, le=200),
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    if rol is not None and rol not in ROLES_VALIDOS:
        raise HTTPException(status_code=422, detail=f"Rol inválido. Opciones: {', '.join(sorted(ROLES_VALIDOS))}.")
    if orden not in ORDENES:
        raise HTTPException(status_code=422, detail=f"Orden inválido. Opciones: {', '.join(ORDENES)}.")

    periodo = _periodo(db, dias)
    # outer join: también aparecen (con ceros) quienes no usaron la plataforma.
    interacciones = func.count(case((_es_interaccion, 1)))
    dias_activos = func.count(distinct(_dia))
    ultima = func.max(EventoActividad.fecha)
    consulta = (
        db.query(
            Usuario,
            interacciones.label("interacciones"),
            func.count(case((EventoActividad.tipo == INICIO_SESION, 1))).label("inicios"),
            dias_activos.label("dias_activos"),
            ultima.label("ultima"),
        )
        .outerjoin(EventoActividad, and_(EventoActividad.usuario_id == Usuario.id, _en_periodo(periodo)))
        .filter(Usuario.activo.is_(True))
        .group_by(Usuario.id)
    )
    if rol:
        consulta = consulta.filter(Usuario.rol == rol)
    if buscar and buscar.strip():
        patron = f"%{buscar.strip()}%"
        consulta = consulta.filter(or_(Usuario.nombre.ilike(patron), Usuario.email.ilike(patron)))

    total = consulta.count()
    criterio = {
        "interacciones": [interacciones.desc(), dias_activos.desc(), Usuario.nombre],
        "dias_activos": [dias_activos.desc(), interacciones.desc(), Usuario.nombre],
        "ultima_actividad": [ultima.desc().nulls_last(), Usuario.nombre],
        "nombre": [Usuario.nombre],
    }[orden]
    filas = consulta.order_by(*criterio, Usuario.id).limit(limite).all()
    return ListaUsoUsuarios(
        periodo=periodo,
        total=total,
        usuarios=[_fila_usuario(u, i, ini, d, ult, dias) for u, i, ini, d, ult in filas],
    )


@router.get("/usuarios/{usuario_id}", response_model=DetalleUsoUsuario)
def uso_de_un_usuario(
    usuario_id: UUID,
    dias: int = Query(DIAS_POR_DEFECTO, ge=DIAS_MIN, le=DIAS_MAX),
    _: Usuario = Depends(solo_admin),
    db: Session = Depends(get_db),
):
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario no encontrado.")

    periodo = _periodo(db, dias)
    en_periodo = and_(_en_periodo(periodo), EventoActividad.usuario_id == usuario.id)
    n_inter, n_inicios, n_dias, ultima = db.query(
        func.count(case((_es_interaccion, 1))),
        func.count(case((EventoActividad.tipo == INICIO_SESION, 1))),
        func.count(distinct(_dia)),
        func.max(EventoActividad.fecha),
    ).filter(en_periodo).one()

    recientes = (
        db.query(EventoActividad.tipo, EventoActividad.fecha)
        .filter(EventoActividad.usuario_id == usuario.id)
        .order_by(EventoActividad.fecha.desc())
        .limit(15)
        .all()
    )
    return DetalleUsoUsuario(
        periodo=periodo,
        usuario=_fila_usuario(usuario, n_inter, n_inicios, n_dias, ultima, dias),
        ultimo_acceso=usuario.ultimo_acceso,
        serie_diaria=_serie(db, periodo, usuario.id),
        por_tipo=_por_tipo(db, periodo, usuario.id),
        recientes=[EventoReciente(tipo=t, etiqueta=ETIQUETAS.get(t, t), fecha=f) for t, f in recientes],
    )
