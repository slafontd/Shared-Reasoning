"""codigo de acceso en cursos

Columna `codigo_acceso` (US12, issue #15): código corto y único con el que un
estudiante encuentra un curso y se inscribe (US13). Los cursos que ya existían
reciben un código generado aquí mismo antes de volver la columna obligatoria.

Revision ID: 3b9e1c7a5d20
Revises: a2c6f8e0d4b1
Create Date: 2026-10-20 00:00:00.000000

"""
import secrets
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '3b9e1c7a5d20'
down_revision: Union[str, None] = 'a2c6f8e0d4b1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# Copia fija de codigos_curso.ALFABETO/LONGITUD: una migración no debe
# depender de código de la app que puede cambiar después.
_ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_LONGITUD = 6


def upgrade() -> None:
    op.add_column('cursos', sa.Column('codigo_acceso', sa.String(length=12), nullable=True))

    conexion = op.get_bind()
    usados = set()
    for (curso_id,) in conexion.execute(sa.text("SELECT id FROM cursos WHERE codigo_acceso IS NULL")).fetchall():
        codigo = "".join(secrets.choice(_ALFABETO) for _ in range(_LONGITUD))
        while codigo in usados:
            codigo = "".join(secrets.choice(_ALFABETO) for _ in range(_LONGITUD))
        usados.add(codigo)
        conexion.execute(
            sa.text("UPDATE cursos SET codigo_acceso = :codigo WHERE id = :id"),
            {"codigo": codigo, "id": curso_id},
        )

    op.alter_column('cursos', 'codigo_acceso', nullable=False)
    op.create_unique_constraint('uq_cursos_codigo_acceso', 'cursos', ['codigo_acceso'])


def downgrade() -> None:
    op.drop_constraint('uq_cursos_codigo_acceso', 'cursos', type_='unique')
    op.drop_column('cursos', 'codigo_acceso')
