from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, UniqueConstraint, LargeBinary, Integer
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship, deferred
from sqlalchemy.sql import func
import uuid
from db.database import Base
from roles import ROL_POR_DEFECTO


class Usuario(Base):
    __tablename__ = "usuarios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, nullable=False)
    contrasena_hash = Column(String(255), nullable=False)
    email_verificado = Column(Boolean, nullable=False, default=False)
    codigo_verificacion = Column(String(20), nullable=True)
    nivel = Column(String(20), nullable=False, default="basico")
    # True solo cuando el usuario completó la encuesta de nivel (#72). Distingue
    # "aún no contestó" de "contestó y su respuesta fue básico" — ambos casos
    # comparten el mismo valor por defecto en `nivel`, así que no se pueden
    # diferenciar sin este flag.
    nivel_confirmado = Column(Boolean, nullable=False, default=False)
    # Preset del carrusel ("/avatares/avatar-3.png") o data URL de una foto
    # subida por el usuario — incluye el prefijo "data:image/...;base64,"
    # (mismo patrón que Sesion.imagen_esquema). NULL = sin foto, se muestra la
    # inicial del nombre.
    foto_perfil = Column(Text, nullable=True)
    # Blob cifrado (Fernet) con las API keys propias del usuario, una por
    # proveedor real — ver providers/cifrado_keys.py. Nunca se guarda en texto
    # plano ni se devuelve al front; solo se exponen flags booleanos de "está
    # configurada" (ver auth.ApiKeysConfiguradas).
    api_keys_cifradas = Column(Text, nullable=True)
    # {"gemini": true} cuando un uso REAL con la key propia de ese proveedor
    # confirmó el 429 "FreeTier" (ver providers.catalogo.es_error_freetier) —
    # es la única señal fiable de falta de facturación para Gemini, porque el
    # listado de /models no la distingue (ver disponibilidad_usuario.py).
    # NULL/ausente = aún no se sabe (se muestra "sin verificar" en el selector).
    sin_facturacion_confirmada = Column(JSONB, nullable=True)
    fecha_registro = Column(DateTime(timezone=True), server_default=func.now())
    # Roles y gestión de usuarios por administrador (US06, ver roles.py y
    # admin.py). El rol "administrador" se asigna solo al registrarse con un
    # correo listado en ADMIN_EMAILS (ver auth.py) o a mano por otro
    # administrador desde /admin/usuarios — nunca se puede auto-otorgar por
    # otra vía. `activo=False` = cuenta desactivada: obtener_usuario_actual la
    # rechaza de inmediato aunque su JWT siga vigente.
    rol = Column(String(20), nullable=False, default=ROL_POR_DEFECTO)
    activo = Column(Boolean, nullable=False, default=True)


class Sesion(Base):
    __tablename__ = "sesiones"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Si se borra un usuario, se borran en cascada todas sus sesiones.
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    # Nombre legible del circuito, para listar el historial de sesiones (#73/#88).
    nombre = Column(String(200), nullable=False, default="Circuito sin nombre")
    netlist = Column(JSONB)
    instrucciones = Column(JSONB)
    historial_chat = Column(JSONB)
    # Data URL (base64) del esquemático subido, comprimida en el navegador
    # antes de mandarla (~1200px de lado máximo) — para restaurarlo al
    # reabrir una sesión desde el historial. Columna ya creada por la
    # migración a1c3e5f7b9d0; el modelo no la declaraba hasta ahora.
    imagen_esquema = Column(Text, nullable=True)
    # Modo de interacción predominante de la sesión (resumen calculado a partir
    # de los mensajes). La fuente de verdad por-mensaje vive en ChatMensaje.
    modo_detectado = Column(String(20))
    metricas = Column(JSONB)
    fecha = Column(DateTime(timezone=True), server_default=func.now())
    # Token aleatorio para compartir esta sesión por link (NULL = nunca se
    # compartió). Se genera en POST /sesiones/{id}/compartir; quien tiene el
    # link puede ver un preview y traerse una COPIA independiente a su propia
    # cuenta (POST /sesiones/compartidas/{token}/importar) — no es edición
    # colaborativa en vivo, cada copia sigue su propio camino después.
    token_compartido = Column(String(64), unique=True, nullable=True, index=True)


class MaterialBiblioteca(Base):
    """Material de estudio (PDF/libro/guía/datasheet) subido por un usuario a
    la biblioteca compartida — complementa a `biblioteca_esquematicos.py`
    (esquemáticos de ejemplo, de solo lectura) con contenido que la comunidad
    va agregando. Ver materiales.py para la subida/descarga real (Supabase
    Storage, bucket privado)."""
    __tablename__ = "materiales_biblioteca"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    titulo = Column(String(200), nullable=False)
    categoria = Column(String(20), nullable=False)
    dificultad = Column(String(20), nullable=False)
    # Rutas DENTRO del bucket privado de Supabase Storage, nunca una URL
    # pública: el archivo y la portada se sirven proxied desde el propio
    # backend (GET /materiales/descargar/{id} y /materiales/portadas/{id}),
    # protegidos por el mismo JWT que el resto de la API — a diferencia de
    # biblioteca_esquematicos.py, este contenido lo sube cualquier usuario
    # autenticado, así que no puede vivir en un bucket público.
    ruta_archivo = Column(String(300), nullable=False)
    ruta_portada = Column(String(300), nullable=True)
    subido_por = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fecha_subida = Column(DateTime(timezone=True), server_default=func.now())


class ChatMensaje(Base):
    __tablename__ = "chat_mensajes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Si se borra una sesión, se borran en cascada todos sus mensajes.
    sesion_id = Column(
        UUID(as_uuid=True),
        ForeignKey("sesiones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    rol = Column(String(20), nullable=False)
    contenido = Column(Text, nullable=False)
    modo_detectado = Column(String(20))
    # Indexado porque el historial se consulta ordenado cronológicamente.
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class Curso(Base):
    """Curso creado por un profesor (US08, #11). Crearlo está restringido al
    rol profesor (US06, ver cursos.crear_curso); un administrador puede
    administrarlo y eliminarlo, y consultarlo sigue abierto a cualquier
    autenticado."""
    __tablename__ = "cursos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre = Column(String(150), nullable=False)
    # Código de la materia en el sistema académico (ej. "ST0263"). Opcional:
    # no todos los cursos del programa corresponden a una materia formal.
    codigo = Column(String(20), nullable=True)
    descripcion = Column(Text, nullable=True)
    # Si se borra el usuario creador, se borran sus cursos (mismo criterio que
    # Sesion y MaterialBiblioteca).
    creado_por = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    # Código para encontrar el curso e inscribirse (US12/US13), estilo
    # Google Classroom: lo genera el sistema al crear el curso y el profesor
    # lo comparte. Es distinto de `codigo` (el de la materia, opcional y que
    # se repite entre grupos) — este es único por curso. Ver codigos_curso.py.
    codigo_acceso = Column(String(12), nullable=False, unique=True)

    creador = relationship("Usuario", lazy="joined")


class Inscripcion(Base):
    """Estudiante inscrito en un curso (US13, #16) — se inscribe con el
    código de acceso del curso (US12). Si se borra el curso o el usuario,
    la inscripción desaparece con él."""
    __tablename__ = "inscripciones"
    __table_args__ = (UniqueConstraint("usuario_id", "curso_id", name="uq_inscripciones_usuario_curso"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    usuario_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    curso_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cursos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    fecha_inscripcion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    curso = relationship("Curso", lazy="joined")


class Ejercicio(Base):
    """Ejercicio de un curso. Base mínima creada para US17 (eliminar
    ejercicio, #21): título y enunciado. Crear y consultar ejercicios con
    todo su detalle corresponde a US14/US15 — que extiendan este modelo en
    vez de crear otro. Si se borra el curso, sus ejercicios se van con él."""
    __tablename__ = "ejercicios"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    curso_id = Column(
        UUID(as_uuid=True),
        ForeignKey("cursos.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    titulo = Column(String(150), nullable=False)
    enunciado = Column(Text, nullable=True)
    creado_por = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
    )
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    curso = relationship("Curso", lazy="joined")
    # Imágenes adjuntas al enunciado. selectin + `datos` diferido: listar los
    # ejercicios trae solo los metadatos, nunca los bytes de cada imagen.
    imagenes = relationship(
        "EjercicioImagen",
        order_by="EjercicioImagen.fecha_creacion",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )


class EjercicioImagen(Base):
    """Imagen adjunta a un ejercicio (diagramas, esquemas, fotos del
    enunciado). Los bytes viven en la base, igual que foto_perfil o
    Sesion.imagen_esquema, para no depender de un bucket externo; se sirven
    por GET /ejercicios/imagenes/{id}, con el mismo control de acceso que el
    ejercicio. Si se borra el ejercicio, sus imágenes se van con él."""
    __tablename__ = "ejercicio_imagenes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ejercicio_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ejercicios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre = Column(String(120), nullable=False)
    mime = Column(String(30), nullable=False)
    tamano = Column(Integer, nullable=False)
    datos = deferred(Column(LargeBinary, nullable=False))
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class Solucion(Base):
    """Solución que un estudiante inscrito entrega a un ejercicio: texto
    opcional y archivos adjuntos (imágenes o PDF). Hay UNA por estudiante y
    ejercicio — volver a enviar la reemplaza. Si se borra el ejercicio o el
    estudiante, la solución desaparece con él."""
    __tablename__ = "soluciones"
    __table_args__ = (UniqueConstraint("ejercicio_id", "estudiante_id", name="uq_soluciones_ejercicio_estudiante"),)

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ejercicio_id = Column(
        UUID(as_uuid=True),
        ForeignKey("ejercicios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    estudiante_id = Column(
        UUID(as_uuid=True),
        ForeignKey("usuarios.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    texto = Column(Text, nullable=True)
    fecha_entrega = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

    estudiante = relationship("Usuario", lazy="joined")
    archivos = relationship(
        "SolucionArchivo",
        order_by="SolucionArchivo.fecha_creacion",
        cascade="all, delete-orphan",
        passive_deletes=True,
        lazy="selectin",
    )


class SolucionArchivo(Base):
    """Archivo adjunto a una solución. Los bytes viven en la base (mismo
    criterio que EjercicioImagen) y se sirven por GET /soluciones/archivos/{id}
    solo al estudiante dueño, al profesor del curso y a un administrador."""
    __tablename__ = "solucion_archivos"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    solucion_id = Column(
        UUID(as_uuid=True),
        ForeignKey("soluciones.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    nombre = Column(String(120), nullable=False)
    mime = Column(String(30), nullable=False)
    tamano = Column(Integer, nullable=False)
    datos = deferred(Column(LargeBinary, nullable=False))
    fecha_creacion = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
