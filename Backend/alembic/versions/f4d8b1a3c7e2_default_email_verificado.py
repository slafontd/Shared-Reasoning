"""default en email_verificado (fix registro roto)

`email_verificado` (ver b63d0a399c7e) quedó NOT NULL sin ningún default a
nivel de servidor. Como el código actual no conoce esa columna (la feature
real que la usa nunca llegó a git), cada INSERT nuevo de `Usuario` la omitía
por completo y Postgres rechazaba la fila entera con un IntegrityError de
NOT NULL — que `POST /auth/registro` interpretaba, por error, como "el email
ya existe" (atrapa cualquier IntegrityError con ese mensaje). Resultado: NINGÚN
registro nuevo funcionaba, aunque el email fuera realmente nuevo.

Mientras esa feature no se implemente en el código de este repo, la columna
simplemente debe defaultear a False en cada fila nueva.

Revision ID: f4d8b1a3c7e2
Revises: e1a7f9c2b6d4
Create Date: 2026-09-24 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'f4d8b1a3c7e2'
down_revision: Union[str, None] = 'e1a7f9c2b6d4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column('usuarios', 'email_verificado', server_default=sa.false())


def downgrade() -> None:
    op.alter_column('usuarios', 'email_verificado', server_default=None)
