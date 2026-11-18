"""retos diarios persistidos (racha)

Tabla retos_diarios: el reto de cada usuario por día y si lo completó. De ahí
sale la racha de días seguidos.

Revision ID: d4b8f2a6c1e5
Revises: a7c3e9b1d5f2
Create Date: 2026-11-18 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'd4b8f2a6c1e5'
down_revision: Union[str, None] = 'a7c3e9b1d5f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'retos_diarios',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('usuario_id', sa.UUID(), nullable=False),
        sa.Column('fecha', sa.Date(), nullable=False),
        sa.Column('reto', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('completado_en', sa.DateTime(timezone=True), nullable=True),
        sa.Column('aciertos', sa.Integer(), nullable=True),
        sa.Column('xp_ganado', sa.Integer(), nullable=True),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('usuario_id', 'fecha', name='uq_retos_diarios_usuario_fecha'),
    )
    op.create_index('ix_retos_diarios_usuario_id', 'retos_diarios', ['usuario_id'])


def downgrade() -> None:
    op.drop_index('ix_retos_diarios_usuario_id', table_name='retos_diarios')
    op.drop_table('retos_diarios')
