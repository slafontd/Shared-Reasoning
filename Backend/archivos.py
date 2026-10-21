"""Validación de archivos subidos por los usuarios (imágenes de ejercicios y
archivos de soluciones).

No se confía en el content-type ni en la extensión que declara el cliente: el
tipo se decide por los primeros bytes. SVG queda fuera a propósito — es XML y
puede llevar scripts, así que servirlo desde nuestro dominio sería un riesgo
de XSS.
"""

import os

from fastapi import HTTPException, UploadFile

_PNG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
_JPEG = bytes([0xFF, 0xD8, 0xFF])


def tipo_de_imagen(contenido: bytes) -> str | None:
    if contenido.startswith(_PNG):
        return "image/png"
    if contenido.startswith(_JPEG):
        return "image/jpeg"
    if contenido[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if contenido[:4] == b"RIFF" and contenido[8:12] == b"WEBP":
        return "image/webp"
    return None


def tipo_de_imagen_o_pdf(contenido: bytes) -> str | None:
    if contenido.startswith(b"%PDF-"):
        return "application/pdf"
    return tipo_de_imagen(contenido)


def nombre_seguro(nombre: str | None, por_defecto: str = "archivo") -> str:
    """Solo el nombre, sin rutas (ni "/" ni "\\"), recortado a 120 caracteres."""
    limpio = os.path.basename((nombre or por_defecto).replace("\\", "/")).strip()[:120]
    return limpio or por_defecto


async def leer_validado(archivo: UploadFile, max_bytes: int, tipo_de) -> tuple[bytes, str]:
    """Lee el archivo (con tope de tamaño) y devuelve (contenido, tipo real).
    Lanza HTTPException 400/413/415 si está vacío, es muy grande o su
    contenido no es de un tipo permitido."""
    # Se lee un byte de más para detectar el exceso sin cargar archivos enormes.
    contenido = await archivo.read(max_bytes + 1)
    if not contenido:
        raise HTTPException(status_code=400, detail=f"«{nombre_seguro(archivo.filename)}» está vacío.")
    if len(contenido) > max_bytes:
        raise HTTPException(status_code=413, detail=f"«{nombre_seguro(archivo.filename)}» supera el límite de {max_bytes // (1024 * 1024)} MB.")
    mime = tipo_de(contenido)
    if mime is None:
        raise HTTPException(status_code=415, detail=f"«{nombre_seguro(archivo.filename)}» no es un tipo de archivo permitido.")
    return contenido, mime
