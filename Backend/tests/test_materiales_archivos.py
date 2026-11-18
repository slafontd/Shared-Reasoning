"""Biblioteca de materiales: subir archivos (PDF y otros tipos permitidos).
Sin Supabase Storage configurado, el archivo se guarda en la base."""

import pymupdf
import pytest

import materiales
from conftest import crear_usuario

FORM = {"titulo": "Guía de Ohm", "categoria": "guia", "dificultad": "basico"}
PNG = bytes([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]) + b"xx"
ZIP = bytes([0x50, 0x4B, 0x03, 0x04]) + b"resto"


@pytest.fixture(autouse=True)
def sin_storage(monkeypatch):
    monkeypatch.setattr(materiales, "SUPABASE_URL", "")
    monkeypatch.setattr(materiales, "SUPABASE_SERVICE_ROLE_KEY", "")


@pytest.fixture
def pdf():
    doc = pymupdf.open()
    doc.new_page().insert_text((72, 72), "Hola biblioteca")
    return doc.tobytes()


def subir(cliente, cabeceras, nombre, datos, **form):
    return cliente.post(
        "/materiales/subir",
        data={**FORM, **form},
        files={"archivo": (nombre, datos, "application/octet-stream")},
        headers=cabeceras,
    )


def test_subir_un_pdf_lo_guarda_con_portada_y_se_descarga_igual(cliente, cabeceras, pdf):
    r = subir(cliente, cabeceras, "guía ohm.pdf", pdf)
    assert r.status_code == 201, r.text
    m = r.json()
    assert m["nombre_archivo"] == "guía ohm.pdf"
    assert m["portada_url"] and m["descarga_url"]

    otro = crear_usuario(cliente, email="otro@eafit.edu.co", nombre="Otro")
    assert any(x["id"] == m["id"] for x in cliente.get("/materiales", headers=otro).json())

    descarga = cliente.get(m["descarga_url"], headers=otro)
    assert descarga.status_code == 200 and descarga.content == pdf
    assert descarga.headers["content-type"] == "application/pdf"
    assert descarga.headers["content-disposition"].startswith("attachment; filename*=UTF-8''")
    assert descarga.headers["x-content-type-options"] == "nosniff"
    portada = cliente.get(m["portada_url"])
    assert portada.status_code == 200 and portada.content[:4] == PNG[:4]
    assert cliente.get(m["descarga_url"]).status_code in (401, 403)


@pytest.mark.parametrize("nombre,datos", [
    ("apuntes.docx", ZIP), ("notas.txt", b"hola"), ("esquema.png", PNG), ("datos.csv", b"a,b\n1,2"),
])
def test_otros_tipos_permitidos(cliente, cabeceras, nombre, datos):
    r = subir(cliente, cabeceras, nombre, datos)
    assert r.status_code == 201, r.text
    assert r.json()["portada_url"] is None  # la portada solo se genera para PDF
    assert cliente.get(r.json()["descarga_url"], headers=cabeceras).content == datos


@pytest.mark.parametrize("nombre,datos,estado", [
    ("virus.exe", b"MZ..", 415),
    ("x.svg", b"<svg onload=alert(1)>", 415),
    ("falso.pdf", b"esto no es un pdf", 400),
    ("falso.docx", b"texto plano", 400),
    ("vacio.pdf", b"", 400),
])
def test_rechaza_tipos_no_permitidos_o_contenido_falso(cliente, cabeceras, nombre, datos, estado):
    assert subir(cliente, cabeceras, nombre, datos).status_code == estado


def test_limite_de_tamano_y_campos(cliente, cabeceras, pdf):
    grande = b"%PDF-" + b"0" * (materiales.MAX_BYTES_MATERIAL + 10)
    assert subir(cliente, cabeceras, "grande.pdf", grande).status_code == 413
    assert subir(cliente, cabeceras, "a.pdf", pdf, categoria="x").status_code == 400
    assert subir(cliente, cabeceras, "a.pdf", pdf, titulo="   ").status_code == 400
    assert subir(cliente, cabeceras, "a.pdf", pdf, titulo="x" * 201).status_code == 400


def test_solo_quien_lo_subio_puede_borrarlo(cliente, cabeceras, pdf):
    m = subir(cliente, cabeceras, "a.pdf", pdf).json()
    otro = crear_usuario(cliente, email="otro@eafit.edu.co", nombre="Otro")
    assert cliente.delete(f"/materiales/{m['id']}", headers=otro).status_code == 403
    assert cliente.delete(f"/materiales/{m['id']}", headers=cabeceras).status_code == 204
    assert cliente.get(m["descarga_url"], headers=cabeceras).status_code == 404
    assert cliente.get(m["portada_url"]).status_code == 404
