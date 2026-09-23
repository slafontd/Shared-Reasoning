"""es_admin y activo en usuarios

Agrega los dos campos que necesita la gestión de usuarios por parte del
administrador: `es_admin` (rol) y `activo` (para desactivar cuentas sin
borrarlas). Reintroduce el concepto de rol que `es_admin` ya había tenido
antes y se quitó (ver b8f4c1a6e2d7) cuando dejó de tener uso — ahora hace
falta de nuevo para restringir /admin/usuarios a administradores.

Revision ID: e1a7f9c2b6d4
Revises: b63d0a399c7e
Create Date: 2026-09-23 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e1a7f9c2b6d4'
down_revision: Union[str, None] = 'b63d0a399c7e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'usuarios',
        sa.Column('es_admin', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.add_column(
        'usuarios',
        sa.Column('activo', sa.Boolean(), nullable=False, server_default=sa.true()),
    )


def downgrade() -> None:
    op.drop_column('usuarios', 'activo')
    op.drop_column('usuarios', 'es_admin')
