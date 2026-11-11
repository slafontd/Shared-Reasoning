"""guardar las revisiones docentes de ejercicios

Revision ID: 4b7e2a9d1c6f
Revises: 9c4a6b1d8e2f
Create Date: 2026-11-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "4b7e2a9d1c6f"
down_revision: Union[str, None] = "9c4a6b1d8e2f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "revisiones_ejercicios",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ejercicio_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("estudiante_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("profesor_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("revisado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ejercicio_id"], ["ejercicios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["estudiante_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["profesor_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ejercicio_id", "estudiante_id", name="uq_revisiones_ejercicio_estudiante"),
    )
    op.create_index(
        "ix_revisiones_ejercicios_ejercicio_id",
        "revisiones_ejercicios",
        ["ejercicio_id"],
    )
    op.create_index(
        "ix_revisiones_ejercicios_estudiante_id",
        "revisiones_ejercicios",
        ["estudiante_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_revisiones_ejercicios_estudiante_id", table_name="revisiones_ejercicios")
    op.drop_index("ix_revisiones_ejercicios_ejercicio_id", table_name="revisiones_ejercicios")
    op.drop_table("revisiones_ejercicios")
