"""cursos

Tabla nueva `cursos` (US08, issue #11): cursos creados por usuarios
autenticados, con nombre, código de materia opcional y descripción.

Revision ID: 7c3e9a2d4f10
Revises: c9a1f4d6b3e8
Create Date: 2026-09-22 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = '7c3e9a2d4f10'
down_revision: Union[str, None] = 'c9a1f4d6b3e8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'cursos',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('nombre', sa.String(length=150), nullable=False),
        sa.Column('codigo', sa.String(length=20), nullable=True),
        sa.Column('descripcion', sa.Text(), nullable=True),
        sa.Column('creado_por', sa.UUID(), nullable=False),
        sa.Column('fecha_creacion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['creado_por'], ['usuarios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_cursos_creado_por', 'cursos', ['creado_por'])


def downgrade() -> None:
    op.drop_index('ix_cursos_creado_por', table_name='cursos')
    op.drop_table('cursos')
