"""rol de usuario (US06) reemplaza a es_admin

Introduce el sistema de roles completo (administrador/profesor/estudiante,
ver roles.py) en vez del flag booleano `es_admin`, que solo distinguía
"admin" de "todos los demás". Se preserva quién ya era admin: esas filas
quedan con rol='administrador', el resto (incluido cualquier futuro profesor)
arranca en 'estudiante', el rol por defecto.

Revision ID: a2c6f8e0d4b1
Revises: f4d8b1a3c7e2
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'a2c6f8e0d4b1'
down_revision: Union[str, None] = 'f4d8b1a3c7e2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'usuarios',
        sa.Column('rol', sa.String(length=20), nullable=False, server_default='estudiante'),
    )
    op.execute("UPDATE usuarios SET rol = 'administrador' WHERE es_admin = true")
    op.alter_column('usuarios', 'rol', server_default=None)
    op.drop_column('usuarios', 'es_admin')


def downgrade() -> None:
    op.add_column(
        'usuarios',
        sa.Column('es_admin', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute("UPDATE usuarios SET es_admin = true WHERE rol = 'administrador'")
    op.alter_column('usuarios', 'es_admin', server_default=None)
    op.drop_column('usuarios', 'rol')
