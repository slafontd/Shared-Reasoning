"""soluciones de ejercicios

Tablas soluciones (una por estudiante y ejercicio) y solucion_archivos (los
adjuntos, como bytes en la base — ver db/models.Solucion).

Revision ID: e8c4f1a7b3d6
Revises: d3b7a1e5c902
Create Date: 2026-10-21 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'e8c4f1a7b3d6'
down_revision: Union[str, None] = 'd3b7a1e5c902'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'soluciones',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('ejercicio_id', sa.UUID(), nullable=False),
        sa.Column('estudiante_id', sa.UUID(), nullable=False),
        sa.Column('texto', sa.Text(), nullable=True),
        sa.Column('fecha_entrega', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['ejercicio_id'], ['ejercicios.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['estudiante_id'], ['usuarios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('ejercicio_id', 'estudiante_id', name='uq_soluciones_ejercicio_estudiante'),
    )
    op.create_index('ix_soluciones_ejercicio_id', 'soluciones', ['ejercicio_id'])
    op.create_index('ix_soluciones_estudiante_id', 'soluciones', ['estudiante_id'])

    op.create_table(
        'solucion_archivos',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('solucion_id', sa.UUID(), nullable=False),
        sa.Column('nombre', sa.String(length=120), nullable=False),
        sa.Column('mime', sa.String(length=30), nullable=False),
        sa.Column('tamano', sa.Integer(), nullable=False),
        sa.Column('datos', sa.LargeBinary(), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['solucion_id'], ['soluciones.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_solucion_archivos_solucion_id', 'solucion_archivos', ['solucion_id'])


def downgrade() -> None:
    op.drop_index('ix_solucion_archivos_solucion_id', table_name='solucion_archivos')
    op.drop_table('solucion_archivos')
    op.drop_index('ix_soluciones_estudiante_id', table_name='soluciones')
    op.drop_index('ix_soluciones_ejercicio_id', table_name='soluciones')
    op.drop_table('soluciones')
