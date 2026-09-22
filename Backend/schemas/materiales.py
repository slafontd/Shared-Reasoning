from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class TutorialComponente(BaseModel):
    resumen: str = Field(description="Definición breve y simple (1-2 oraciones) de qué es el componente.")
    como_funciona: str = Field(description="Principio básico de funcionamiento, explicado en palabras sencillas.")
    usos_comunes: list[str] = Field(description="3 ejemplos de aplicaciones muy comunes de este componente.")
    consejos_conexion: str = Field(description="Consejos clave al conectarlo en la protoboard (polaridad, resistencias necesarias, pines típicos).")


class TutorialChatRequest(BaseModel):
    componente: str = Field(min_length=1, max_length=100)
    mensaje: str = Field(min_length=1, max_length=2000)
    # [{"role": "user"|"assistant", "content": "..."}] — mismo formato que
    # historial_chat en el resto de la API.
    historial: list[dict] = Field(default_factory=list)


class MaterialResponse(BaseModel):
    id: UUID
    titulo: str
    categoria: str
    dificultad: str
    # Rutas propias del backend (nunca del bucket de Supabase), listas para
    # usarse directo como src/href en el frontend — ver materiales.py.
    portada_url: str | None = None
    descarga_url: str
    subido_por: UUID
    fecha_subida: datetime

    model_config = {"from_attributes": True}
