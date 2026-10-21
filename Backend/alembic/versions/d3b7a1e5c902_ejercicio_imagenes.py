"""imagenes de ejercicios

Tabla ejercicio_imagenes: imágenes adjuntas al enunciado de un ejercicio,
guardadas como bytes en la base (ver db/models.EjercicioImagen).

Revision ID: d3b7a1e5c902
Revises: 8f1a3c6e2b47
Create Date: 2026-10-21 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'd3b7a1e5c902'
down_revision: Union[str, None] = '8f1a3c6e2b47'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ejercicio_imagenes',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('ejercicio_id', sa.UUID(), nullable=False),
        sa.Column('nombre', sa.String(length=120), nullable=False),
        sa.Column('mime', sa.String(length=30), nullable=False),
        sa.Column('tamano', sa.Integer(), nullable=False),
        sa.Column('datos', sa.LargeBinary(), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['ejercicio_id'], ['ejercicios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ejercicio_imagenes_ejercicio_id', 'ejercicio_imagenes', ['ejercicio_id'])


def downgrade() -> None:
    op.drop_index('ix_ejercicio_imagenes_ejercicio_id', table_name='ejercicio_imagenes')
    op.drop_table('ejercicio_imagenes')
