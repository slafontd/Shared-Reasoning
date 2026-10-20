"""inscripciones a cursos

Tabla `inscripciones` (US13, issue #16): qué estudiante está inscrito en qué
curso. Un estudiante se inscribe una sola vez por curso (restricción única).

Revision ID: 5e2d8f4b9a61
Revises: 3b9e1c7a5d20
Create Date: 2026-10-20 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '5e2d8f4b9a61'
down_revision: Union[str, None] = '3b9e1c7a5d20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'inscripciones',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('usuario_id', sa.UUID(), nullable=False),
        sa.Column('curso_id', sa.UUID(), nullable=False),
        sa.Column('fecha_inscripcion', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['curso_id'], ['cursos.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('usuario_id', 'curso_id', name='uq_inscripciones_usuario_curso'),
    )
    op.create_index('ix_inscripciones_usuario_id', 'inscripciones', ['usuario_id'])
    op.create_index('ix_inscripciones_curso_id', 'inscripciones', ['curso_id'])


def downgrade() -> None:
    op.drop_index('ix_inscripciones_curso_id', table_name='inscripciones')
    op.drop_index('ix_inscripciones_usuario_id', table_name='inscripciones')
    op.drop_table('inscripciones')
