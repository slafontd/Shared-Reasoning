"""fecha de actualización de ejercicios

US16: se registra cuándo el profesor modificó un ejercicio por última vez.

Revision ID: f2a8d4c6b1e9
Revises: e8c4f1a7b3d6
Create Date: 2026-10-21 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f2a8d4c6b1e9'
down_revision: Union[str, None] = 'e8c4f1a7b3d6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('ejercicios', sa.Column('fecha_actualizacion', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('ejercicios', 'fecha_actualizacion')
