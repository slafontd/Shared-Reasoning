"""ejercicios de un curso

Tabla `ejercicios` (base para US17 eliminar ejercicio, issue #21): título y
enunciado por curso. Se borran en cascada con el curso.

Revision ID: 8f1a3c6e2b47
Revises: 5e2d8f4b9a61
Create Date: 2026-10-20 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '8f1a3c6e2b47'
down_revision: Union[str, None] = '5e2d8f4b9a61'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'ejercicios',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('curso_id', sa.UUID(), nullable=False),
        sa.Column('titulo', sa.String(length=150), nullable=False),
        sa.Column('enunciado', sa.Text(), nullable=True),
        sa.Column('creado_por', sa.UUID(), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['curso_id'], ['cursos.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['creado_por'], ['usuarios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_ejercicios_curso_id', 'ejercicios', ['curso_id'])


def downgrade() -> None:
    op.drop_index('ix_ejercicios_curso_id', table_name='ejercicios')
    op.drop_table('ejercicios')
