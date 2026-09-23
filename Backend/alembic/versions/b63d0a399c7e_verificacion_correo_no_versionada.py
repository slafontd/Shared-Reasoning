"""adoptar verificacion de correo (aplicada sin pasar por git)

Alguien del equipo agregó `email_verificado`/`codigo_verificacion` a `usuarios`
corriendo una migración directo contra la base compartida de Supabase, sin
subir el código a git — el `alembic_version` de la base quedó apuntando a
'b63d0a399c7e', una revisión que no existía en ningún commit. Sin este
archivo, cualquier `alembic upgrade head` (de cualquiera del equipo) fallaba
con "Can't locate revision", y como esa revisión tampoco encajaba en la
cadena, nuestras migraciones posteriores (es_admin/activo) nunca llegaron a
aplicarse — eso rompía POST /auth/login con un 500 real.

Este archivo NO es un rediseño de esa feature (no tenemos el código que la usa,
así que no sabemos su lógica real) — solo documenta en git el estado físico
que la base YA tiene, para que el historial de Alembic vuelva a ser una fuente
de verdad consistente. Si quien empezó esa feature todavía la tiene en su
máquina, debe traer su código real (el que lee/escribe estas columnas) en un
PR aparte; esta migración no se toca para eso.

Revision ID: b63d0a399c7e
Revises: 7c3e9a2d4f10
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'b63d0a399c7e'
down_revision: Union[str, None] = '7c3e9a2d4f10'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # NOT NULL sin default a nivel de servidor (así quedó en la base real):
    # se agrega con un default temporal para no romper las filas existentes,
    # y se retira después — patrón estándar para añadir NOT NULL a una tabla
    # con datos.
    op.add_column(
        'usuarios',
        sa.Column('email_verificado', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.alter_column('usuarios', 'email_verificado', server_default=None)
    op.add_column(
        'usuarios',
        sa.Column('codigo_verificacion', sa.String(length=20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('usuarios', 'codigo_verificacion')
    op.drop_column('usuarios', 'email_verificado')
