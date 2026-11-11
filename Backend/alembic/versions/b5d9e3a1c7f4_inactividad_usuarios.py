"""ultimo acceso y desactivacion por inactividad

Columnas `ultimo_acceso` y `desactivado_por_inactividad` en usuarios (US07,
issue #9). A las cuentas existentes se les pone ultimo_acceso = ahora: el
plazo de inactividad empieza a contar desde esta migración, así nadie queda
desactivado de golpe al aplicarla.

Revision ID: b5d9e3a1c7f4
Revises: 6a2f9c4d7b1e
Create Date: 2026-11-11 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'b5d9e3a1c7f4'
down_revision: Union[str, None] = '6a2f9c4d7b1e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('usuarios', sa.Column('ultimo_acceso', sa.DateTime(timezone=True), nullable=True))
    op.add_column(
        'usuarios',
        sa.Column('desactivado_por_inactividad', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.execute("UPDATE usuarios SET ultimo_acceso = now() WHERE ultimo_acceso IS NULL")


def downgrade() -> None:
    op.drop_column('usuarios', 'desactivado_por_inactividad')
    op.drop_column('usuarios', 'ultimo_acceso')
