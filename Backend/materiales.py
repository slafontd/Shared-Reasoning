"""Biblioteca de materiales de estudio (PDFs, libros, guías, datasheets)
subidos por los propios usuarios — complementa a `biblioteca_esquematicos.py`
(esquemáticos de ejemplo, de solo lectura, bucket público) con contenido que
la comunidad va agregando.

A diferencia de la biblioteca de esquemáticos, esto necesita escritura real y
control de acceso: cualquiera con la ANON_KEY podría escribir en un bucket
público, así que acá se usa la Service Role Key de Supabase (nunca la anon
key, nunca expuesta al frontend) para subir/leer/borrar, y cada archivo se
sirve proxied a través de un endpoint propio protegido con JWT (ver main.py)
en vez de una URL pública de Supabase.
"""

import json
import os
from urllib.parse import quote

import httpx
from dotenv import load_dotenv

from archivos import nombre_seguro, tipo_de_imagen_o_pdf
from providers.catalogo import crear_provider_razonamiento
from schemas.materiales import TutorialComponente

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
BUCKET = "materiales-biblioteca"

CATEGORIAS_VALIDAS = {"libro", "pdf", "guia", "datasheet"}
DIFICULTADES_VALIDAS = {"basico", "intermedio", "experto", "referencia"}


# Tipos que se pueden subir (extensión → tipo real). El contenido se comprueba
# contra la extensión (validar_material): no se confía en lo que declara el
# cliente. Sin SVG/HTML/ejecutables a propósito: servidos desde nuestro
# dominio podrían llevar scripts.
TIPOS_PERMITIDOS = {
    ".pdf": "application/pdf",
    ".epub": "application/epub+zip",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".ppt": "application/vnd.ms-powerpoint",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
}
MAX_BYTES_MATERIAL = 20 * 1024 * 1024
_ZIP = bytes([0x50, 0x4B, 0x03, 0x04])
_OLE = bytes([0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1])


def _coincide_con_extension(extension: str, contenido: bytes) -> bool:
    if extension in (".pdf", ".png", ".jpg", ".jpeg"):
        real = tipo_de_imagen_o_pdf(contenido)
        return real == TIPOS_PERMITIDOS[extension]
    if extension in (".docx", ".pptx", ".xlsx", ".epub"):
        return contenido.startswith(_ZIP)
    if extension in (".doc", ".ppt", ".xls"):
        return contenido.startswith(_OLE)
    return b"\x00" not in contenido[:8192]  # .txt/.md/.csv: texto, no binario


def validar_material(nombre: str | None, contenido: bytes) -> tuple[str, str]:
    """Devuelve (extensión, tipo) o lanza ValueError con un mensaje para el usuario."""
    extension = os.path.splitext(nombre_seguro(nombre))[1].lower()
    if extension not in TIPOS_PERMITIDOS:
        permitidas = ", ".join(sorted(e.lstrip(".") for e in TIPOS_PERMITIDOS))
        raise ValueError(f"Tipo de archivo no permitido. Puedes subir: {permitidas}.")
    if not contenido:
        raise ValueError("El archivo está vacío.")
    if len(contenido) > MAX_BYTES_MATERIAL:
        raise ValueError(f"El archivo supera el límite de {MAX_BYTES_MATERIAL // (1024 * 1024)} MB.")
    if not _coincide_con_extension(extension, contenido):
        raise ValueError(f"El contenido del archivo no corresponde a un «{extension}» válido.")
    return extension, TIPOS_PERMITIDOS[extension]


def storage_configurado() -> bool:
    return bool(SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY)


def _headers() -> dict:
    return {
        "apikey": SUPABASE_SERVICE_ROLE_KEY,
        "authorization": f"Bearer {SUPABASE_SERVICE_ROLE_KEY}",
    }


async def subir_archivo(ruta: str, contenido: bytes, content_type: str) -> None:
    async with httpx.AsyncClient(timeout=30.0) as cliente:
        r = await cliente.post(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{quote(ruta)}",
            headers={**_headers(), "content-type": content_type},
            content=contenido,
        )
        r.raise_for_status()


async def descargar_archivo(ruta: str) -> bytes:
    async with httpx.AsyncClient(timeout=30.0) as cliente:
        r = await cliente.get(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{quote(ruta)}",
            headers=_headers(),
        )
        r.raise_for_status()
        return r.content


async def borrar_archivo(ruta: str) -> None:
    async with httpx.AsyncClient(timeout=15.0) as cliente:
        r = await cliente.delete(
            f"{SUPABASE_URL}/storage/v1/object/{BUCKET}/{quote(ruta)}",
            headers=_headers(),
        )
        # 404 = ya no está, que es justo el estado que queríamos lograr — no
        # es un error real que deba tumbar el borrado del registro en la BD.
        if r.status_code not in (200, 404):
            r.raise_for_status()


def generar_portada_pdf(pdf_bytes: bytes) -> bytes | None:
    """Renderiza la primera página del PDF como PNG para usarla de portada.

    Devuelve None si el archivo no es un PDF válido o no tiene páginas — el
    front cae a un ícono genérico por categoría en ese caso; no es un error
    que deba tumbar la subida del material."""
    try:
        import fitz  # PyMuPDF

        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        if len(doc) == 0:
            return None
        pixmap = doc[0].get_pixmap(dpi=150)
        return pixmap.tobytes("png")
    except Exception:
        return None


PROMPT_TUTORIAL = """Eres un ingeniero experto en electrónica explicando un componente a un estudiante.

Componente: {componente}

Responde ÚNICAMENTE con un JSON válido, sin texto adicional ni bloques de código markdown, con esta forma exacta:
{{
    "resumen": "definición breve y simple (1-2 oraciones)",
    "como_funciona": "principio básico de funcionamiento, en palabras sencillas",
    "usos_comunes": ["uso 1", "uso 2", "uso 3"],
    "consejos_conexion": "consejos clave al conectarlo en la protoboard (polaridad, resistencias necesarias, pines típicos)"
}}

Usa español neutro, tono amigable y conciso."""


async def generar_tutorial(componente: str) -> TutorialComponente:
    proveedor = crear_provider_razonamiento()
    respuesta = await proveedor.client.chat.completions.create(
        model=proveedor.model,
        messages=[{"role": "user", "content": PROMPT_TUTORIAL.format(componente=componente)}],
    )
    texto = (respuesta.choices[0].message.content or "").strip()
    texto = texto.replace("```json", "").replace("```", "").strip()
    return TutorialComponente(**json.loads(texto))


async def responder_tutorial_chat(componente: str, mensaje: str, historial: list[dict]) -> str:
    sistema = {
        "role": "system",
        "content": (
            f"Eres un asistente de electrónica ayudando a un estudiante a entender el "
            f"componente '{componente}'. Responde de forma concisa y clara, en español neutro."
        ),
    }
    proveedor = crear_provider_razonamiento()
    respuesta = await proveedor.client.chat.completions.create(
        model=proveedor.model,
        messages=[sistema, *historial, {"role": "user", "content": mensaje}],
    )
    return respuesta.choices[0].message.content or ""
