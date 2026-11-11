"""Desactivación de cuentas por inactividad (US07, issue #9).

Una cuenta que pasa más de DIAS_INACTIVIDAD días sin iniciar sesión ni usar
la app se desactiva: deja de poder entrar hasta que un administrador la
reactive desde la gestión de usuarios. Así no quedan cuentas abandonadas con
acceso (por ejemplo, de estudiantes que ya terminaron el curso).

Cómo se aplica, sin necesidad de un proceso programado (cron):
- Al iniciar sesión: si la cuenta superó el plazo, se desactiva en ese
  momento y se le explica el motivo.
- Un administrador puede además barrer todas las cuentas inactivas de una vez
  (POST /admin/usuarios/desactivar-inactivos).

Los administradores nunca se desactivan por inactividad: si el único admin
se quedara fuera, nadie podría reactivar cuentas.
"""

import os
from datetime import datetime, timedelta, timezone

from sqlalchemy import or_
from sqlalchemy.orm import Session

from db.models import Usuario
from roles import ADMINISTRADOR

# Configurable en el .env. Por defecto ~6 meses: más que unas vacaciones
# entre semestres, para no bloquear a quien vuelve al siguiente periodo.
DIAS_INACTIVIDAD = max(1, int(os.getenv("DIAS_INACTIVIDAD", "180")))

# Cada petición autenticada actualiza ultimo_acceso, pero como mucho una vez
# por hora por usuario: suficiente precisión y evita una escritura en la BD
# en cada clic.
_INTERVALO_REGISTRO = timedelta(hours=1)

MENSAJE_DESACTIVADA = (
    f"Tu cuenta se desactivó por inactividad: pasaron más de {DIAS_INACTIVIDAD} días "
    "sin que ingresaras. Pídele a un administrador que la reactive."
)


def ahora() -> datetime:
    return datetime.now(timezone.utc)


def _fecha_referencia(usuario: Usuario) -> datetime | None:
    # Una cuenta que nunca registró acceso cuenta desde su registro.
    return usuario.ultimo_acceso or usuario.fecha_registro


def esta_inactivo(usuario: Usuario, momento: datetime | None = None) -> bool:
    if usuario.rol == ADMINISTRADOR:
        return False
    referencia = _fecha_referencia(usuario)
    if referencia is None:
        return False
    if referencia.tzinfo is None:
        referencia = referencia.replace(tzinfo=timezone.utc)
    return (momento or ahora()) - referencia > timedelta(days=DIAS_INACTIVIDAD)


def desactivar_por_inactividad(usuario: Usuario) -> None:
    usuario.activo = False
    usuario.desactivado_por_inactividad = True


def registrar_acceso(db: Session, usuario: Usuario, forzar: bool = False) -> None:
    """Marca que el usuario acaba de usar la app (throttled a 1/hora)."""
    momento = ahora()
    ultimo = usuario.ultimo_acceso
    if ultimo is not None and ultimo.tzinfo is None:
        ultimo = ultimo.replace(tzinfo=timezone.utc)
    if forzar or ultimo is None or momento - ultimo >= _INTERVALO_REGISTRO:
        usuario.ultimo_acceso = momento
        db.commit()


def desactivar_inactivos(db: Session) -> list[Usuario]:
    """Desactiva todas las cuentas activas que superaron el plazo."""
    limite = ahora() - timedelta(days=DIAS_INACTIVIDAD)
    candidatos = (
        db.query(Usuario)
        .filter(
            Usuario.activo.is_(True),
            Usuario.rol != ADMINISTRADOR,
            or_(
                Usuario.ultimo_acceso < limite,
                (Usuario.ultimo_acceso.is_(None)) & (Usuario.fecha_registro < limite),
            ),
        )
        .all()
    )
    for usuario in candidatos:
        desactivar_por_inactividad(usuario)
    db.commit()
    return candidatos
