from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator

from agents.verbosidad import NIVELES_VALIDOS
from auth import normalizar_email, validar_correo_institucional


def _validar_nivel(valor: str | None) -> str | None:
    if valor is not None and valor not in NIVELES_VALIDOS:
        raise ValueError(f"Nivel inválido. Valores válidos: {sorted(NIVELES_VALIDOS)}")
    return valor


class AdminUsuarioResponse(BaseModel):
    id: UUID
    nombre: str
    email: str
    nivel: str
    es_admin: bool
    activo: bool
    fecha_registro: datetime

    model_config = {"from_attributes": True}


class AdminUsuarioCrear(BaseModel):
    nombre: str = Field(min_length=1, max_length=100)
    email: EmailStr
    # Mismas reglas que el autoregistro (RegistroRequest en auth.py): el
    # administrador crea la cuenta, pero la contraseña la define quien la va
    # a usar debería cambiarla — no se manda ninguna por correo.
    contrasena: str = Field(min_length=12, max_length=128)
    nivel: str = Field(default="basico")
    es_admin: bool = False

    _normalizar_email = field_validator("email", mode="before")(normalizar_email)
    _email_institucional = field_validator("email")(validar_correo_institucional)
    _nivel_valido = field_validator("nivel")(_validar_nivel)

    @field_validator("contrasena")
    @classmethod
    def validar_complejidad(cls, valor: str) -> str:
        if not any(c.isupper() for c in valor):
            raise ValueError("La contraseña debe incluir al menos una mayúscula.")
        if not any(c.islower() for c in valor):
            raise ValueError("La contraseña debe incluir al menos una minúscula.")
        if not any(c.isdigit() for c in valor):
            raise ValueError("La contraseña debe incluir al menos un número.")
        return valor


class AdminUsuarioActualizar(BaseModel):
    # Todos opcionales: se actualiza solo lo que venga (mismo criterio que
    # PerfilRequest en auth.py).
    nombre: str | None = Field(default=None, min_length=1, max_length=100)
    email: EmailStr | None = None
    nivel: str | None = None
    es_admin: bool | None = None
    activo: bool | None = None

    _normalizar_email = field_validator("email", mode="before")(normalizar_email)
    _email_institucional = field_validator("email")(validar_correo_institucional)
    _nivel_valido = field_validator("nivel")(_validar_nivel)
