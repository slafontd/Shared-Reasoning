"""registro de actividad de los usuarios

US30: tabla eventos_actividad (quién hizo qué tipo de cosa y cuándo). Se
rellena con el historial que ya existe (circuitos, preguntas al asistente,
entregas e inscripciones) para que las métricas no arranquen vacías; los
inicios de sesión y el uso de la app solo se registran hacia adelante.

Revision ID: a7c3e9b1d5f2
Revises: b5d9e3a1c7f4
Create Date: 2026-11-11 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a7c3e9b1d5f2'
down_revision: Union[str, None] = 'b5d9e3a1c7f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'eventos_actividad',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('usuario_id', sa.UUID(), nullable=False),
        sa.Column('tipo', sa.String(length=30), nullable=False),
        sa.Column('fecha', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['usuario_id'], ['usuarios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_eventos_actividad_usuario_id', 'eventos_actividad', ['usuario_id'])
    op.create_index('ix_eventos_actividad_fecha', 'eventos_actividad', ['fecha'])

    # Historial existente.
    op.execute("""
        INSERT INTO eventos_actividad (id, usuario_id, tipo, fecha)
        SELECT gen_random_uuid(), usuario_id, 'circuito', fecha FROM sesiones WHERE fecha IS NOT NULL
    """)
    op.execute("""
        INSERT INTO eventos_actividad (id, usuario_id, tipo, fecha)
        SELECT gen_random_uuid(), s.usuario_id, 'chat', m.timestamp
        FROM chat_mensajes m JOIN sesiones s ON s.id = m.sesion_id
        WHERE m.rol = 'user' AND m.timestamp IS NOT NULL
    """)
    op.execute("""
        INSERT INTO eventos_actividad (id, usuario_id, tipo, fecha)
        SELECT gen_random_uuid(), estudiante_id, 'entrega', fecha_entrega FROM soluciones
    """)
    op.execute("""
        INSERT INTO eventos_actividad (id, usuario_id, tipo, fecha)
        SELECT gen_random_uuid(), usuario_id, 'inscripcion', fecha_inscripcion FROM inscripciones
    """)


def downgrade() -> None:
    op.drop_index('ix_eventos_actividad_fecha', table_name='eventos_actividad')
    op.drop_index('ix_eventos_actividad_usuario_id', table_name='eventos_actividad')
    op.drop_table('eventos_actividad')
