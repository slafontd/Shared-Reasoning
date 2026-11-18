"""materiales de la biblioteca guardables en la base de datos

Sin Supabase Storage configurado, el archivo del material (y su portada) se
guardan en estas columnas. Si hay Storage, quedan en NULL.

Revision ID: e9a3c7d1b5f4
Revises: d4b8f2a6c1e5
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e9a3c7d1b5f4'
down_revision: Union[str, None] = 'd4b8f2a6c1e5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('materiales_biblioteca', sa.Column('datos', sa.LargeBinary(), nullable=True))
    op.add_column('materiales_biblioteca', sa.Column('portada_datos', sa.LargeBinary(), nullable=True))
    op.add_column('materiales_biblioteca', sa.Column('mime', sa.String(length=100), nullable=True))
    op.add_column('materiales_biblioteca', sa.Column('nombre_archivo', sa.String(length=255), nullable=True))
    op.add_column('materiales_biblioteca', sa.Column('tamano', sa.Integer(), nullable=True))


def downgrade() -> None:
    for col in ('tamano', 'nombre_archivo', 'mime', 'portada_datos', 'datos'):
        op.drop_column('materiales_biblioteca', col)
