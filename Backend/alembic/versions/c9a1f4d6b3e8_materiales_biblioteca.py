"""materiales de biblioteca

Tabla nueva `materiales_biblioteca` — materiales de estudio (PDFs, libros,
guías, datasheets) que cualquier usuario autenticado puede subir a una
biblioteca compartida, con portada auto-generada para PDFs (ver
materiales.py). El archivo real vive en un bucket PRIVADO de Supabase
Storage (`materiales-biblioteca`), no en esta tabla — acá solo se guarda la
ruta dentro del bucket, nunca una URL pública, porque a diferencia de
`biblioteca_esquematicos.py` (bucket público de solo lectura) este contenido
lo sube cada usuario y se sirve proxied a través del backend con JWT.

Revision ID: c9a1f4d6b3e8
Revises: a8d3ec5a269d
Create Date: 2026-09-22 00:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'c9a1f4d6b3e8'
down_revision: Union[str, None] = 'a8d3ec5a269d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'materiales_biblioteca',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('titulo', sa.String(length=200), nullable=False),
        sa.Column('categoria', sa.String(length=20), nullable=False),
        sa.Column('dificultad', sa.String(length=20), nullable=False),
        sa.Column('ruta_archivo', sa.String(length=300), nullable=False),
        sa.Column('ruta_portada', sa.String(length=300), nullable=True),
        sa.Column('subido_por', sa.UUID(), nullable=False),
        sa.Column('fecha_subida', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.ForeignKeyConstraint(['subido_por'], ['usuarios.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_materiales_biblioteca_subido_por', 'materiales_biblioteca', ['subido_por'])


def downgrade() -> None:
    op.drop_index('ix_materiales_biblioteca_subido_por', table_name='materiales_biblioteca')
    op.drop_table('materiales_biblioteca')
