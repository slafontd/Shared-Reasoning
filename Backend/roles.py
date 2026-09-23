"""Roles del sistema (US06): Administrador, Profesor, Estudiante.

Reemplaza el flag booleano `es_admin` (gestión de usuarios) — un usuario tiene
EXACTAMENTE uno de los tres roles, nunca "admin y además profesor" a la vez.
`requerir_rol()` (auth.py) es la dependencia genérica que cualquier endpoint
nuevo debe usar para restringirse a uno o varios roles; `requerir_admin` es
solo el caso particular más común (administración de usuarios).
"""

ADMINISTRADOR = "administrador"
PROFESOR = "profesor"
ESTUDIANTE = "estudiante"

ROLES_VALIDOS = {ADMINISTRADOR, PROFESOR, ESTUDIANTE}
ROL_POR_DEFECTO = ESTUDIANTE


def normalizar_rol(rol: str | None) -> str:
    """Para lectura defensiva (nunca debería hacer falta si la validación de
    escritura funciona, pero una fila con un valor viejo/corrupto no debe
    tumbar la app) — mismo criterio que verbosidad.normalizar_nivel."""
    r = (rol or "").strip().lower()
    return r if r in ROLES_VALIDOS else ROL_POR_DEFECTO


def validar_rol(rol: str | None) -> str | None:
    """Validador de Pydantic: a diferencia de normalizar_rol, un valor
    inválido en un request SÍ debe rechazarse con un error claro, no
    corregirse en silencio."""
    if rol is not None and rol not in ROLES_VALIDOS:
        raise ValueError(f"Rol inválido. Valores válidos: {sorted(ROLES_VALIDOS)}")
    return rol
