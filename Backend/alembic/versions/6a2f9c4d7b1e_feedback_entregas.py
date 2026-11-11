"""guardar feedback docente en las entregas de ejercicios

Revision ID: 6a2f9c4d7b1e
Revises: 4b7e2a9d1c6f
Create Date: 2026-11-11 01:12:42.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


revision: str = "6a2f9c4d7b1e"
down_revision: Union[str, None] = "4b7e2a9d1c6f"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    columns = {column["name"] for column in inspector.get_columns("soluciones")}
    columnas_feedback = (
        ("feedback", sa.Text()),
        ("feedback_profesor_id", postgresql.UUID(as_uuid=True)),
        ("feedback_actualizado_en", sa.DateTime(timezone=True)),
    )
    for nombre, tipo in columnas_feedback:
        if nombre not in columns:
            op.add_column("soluciones", sa.Column(nombre, tipo, nullable=True))

    constraint_name = "fk_soluciones_feedback_profesor_id_usuarios"
    constraints = {constraint["name"] for constraint in inspector.get_foreign_keys("soluciones")}
    if constraint_name not in constraints:
        op.create_foreign_key(
            constraint_name,
            "soluciones",
            "usuarios",
            ["feedback_profesor_id"],
            ["id"],
            ondelete="SET NULL",
        )


def downgrade() -> None:
    inspector = sa.inspect(op.get_bind())
    constraint_name = "fk_soluciones_feedback_profesor_id_usuarios"
    constraints = {constraint["name"] for constraint in inspector.get_foreign_keys("soluciones")}
    if constraint_name in constraints:
        op.drop_constraint(constraint_name, "soluciones", type_="foreignkey")

    columns = {column["name"] for column in sa.inspect(op.get_bind()).get_columns("soluciones")}
    for name in ("feedback_actualizado_en", "feedback_profesor_id", "feedback"):
        if name in columns:
            op.drop_column("soluciones", name)
