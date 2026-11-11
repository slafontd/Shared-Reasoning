"""guardar borradores de progreso por estudiante y ejercicio

Revision ID: 9c4a6b1d8e2f
Revises: f2a8d4c6b1e9
Create Date: 2026-11-11 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "9c4a6b1d8e2f"
down_revision: Union[str, None] = "f2a8d4c6b1e9"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "progresos_ejercicios",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("ejercicio_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("estudiante_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("respuestas", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("preguntas_completadas", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("punto_actual", sa.Integer(), nullable=False),
        sa.Column("actualizado_en", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["ejercicio_id"], ["ejercicios.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["estudiante_id"], ["usuarios.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("ejercicio_id", "estudiante_id", name="uq_progresos_ejercicio_estudiante"),
    )
    op.create_index(
        "ix_progresos_ejercicios_ejercicio_id",
        "progresos_ejercicios",
        ["ejercicio_id"],
    )
    op.create_index(
        "ix_progresos_ejercicios_estudiante_id",
        "progresos_ejercicios",
        ["estudiante_id"],
    )


def downgrade() -> None:
    op.drop_index("ix_progresos_ejercicios_estudiante_id", table_name="progresos_ejercicios")
    op.drop_index("ix_progresos_ejercicios_ejercicio_id", table_name="progresos_ejercicios")
    op.drop_table("progresos_ejercicios")
