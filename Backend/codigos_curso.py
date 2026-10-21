"""Códigos de acceso de los cursos (US12 buscar, #15 · US13 inscribirse, #16).

Cada curso tiene un código corto y único que el profesor comparte con sus
estudiantes, estilo Google Classroom (ej. "K7P2QX"). Se usa un alfabeto sin
caracteres que se confunden al dictarlos o copiarlos a mano (0/O, 1/I/L), y
la búsqueda normaliza lo que escribe el estudiante (minúsculas, espacios,
guiones), así "k7p2-qx" encuentra "K7P2QX".
"""

import secrets

ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
LONGITUD = 6


def generar_codigo() -> str:
    # 31^6 ≈ 887 millones de combinaciones: imposible de adivinar a ciegas y
    # las colisiones son rarísimas (igual se reintenta, ver nuevo_codigo_unico).
    return "".join(secrets.choice(ALFABETO) for _ in range(LONGITUD))


def normalizar_codigo(texto: str) -> str:
    return "".join(c for c in texto.upper() if c.isalnum())


def nuevo_codigo_unico(existe) -> str:
    """`existe(codigo) -> bool` consulta la BD; se reintenta ante colisión."""
    for _ in range(20):
        codigo = generar_codigo()
        if not existe(codigo):
            return codigo
    raise RuntimeError("No se pudo generar un código de acceso único para el curso.")
