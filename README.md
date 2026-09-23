# Paralelo

### Human–AI co-execution of physical tasks through adaptive guidance

**Programa Delfín · Universidad EAFIT · 2026**

---

## ¿Qué es Paralelo?

**Paralelo** es una aplicación web conversacional que convierte imágenes de esquemáticos eléctricos en instrucciones paso a paso para armar circuitos en una protoboard física.

El usuario sube la foto de un diagrama, el sistema identifica los componentes y su topología, genera instrucciones visuales interactivas sobre un canvas de la protoboard, y mantiene un **chat** donde el usuario puede hacer preguntas, proponer cambios de conexión o mover componentes — con el circuito actualizándose en tiempo real.

Es el **primer módulo funcional** del proyecto de investigación **Shared Reasoning**, que estudia la co-ejecución de tareas físicas complejas entre humanos e inteligencia artificial.

> Este repositorio es la **fusión** de dos implementaciones que divergieron del mismo proyecto original: el pipeline de IA, la autenticación y el canvas vienen del repo oficial (`DanteXhunter/Shared_Reasoning` → `CircuitBuilderAI`); la Biblioteca de materiales y los Retos gamificados vienen de un fork con features de producto propias (`Saul0604/Shared_Reasoning`), reescritos para encajar en este stack.

---

## Propuesta de valor

A diferencia de un tutorial estático, Paralelo **adapta su guía** al usuario y registra **cómo** colabora la persona con la IA. El proyecto estudia los cinco tipos de interacción humano–IA en tareas físicas:

| Tipo | Descripción |
|------|-------------|
| **IN-the-Loop** | El humano decide en cada paso; máxima supervisión. |
| **ON-the-Loop** | La IA opera; el humano supervisa e interviene. |
| **OVER-the-Loop** | El humano define objetivos; supervisión estratégica. |
| **UNDER-the-Loop** | La IA guía; el humano ejecuta. |
| **ALONG-the-Loop** | Humano e IA trabajan en paralelo, en asociación. |

El tipo de interacción **no es fijo**: se **diagnostica en cada turno** (al planificar y en cada mensaje del chat) y cambia durante la sesión según el nivel del usuario y sus decisiones. Ese diagnóstico se registra por mensaje para el análisis de investigación. Las instrucciones, además, se redactan según el nivel autoreportado en la encuesta (**básico / experto**; el nivel *intermedio* sigue soportado en el backend pero está oculto en la UI).

---

## Cómo funciona

### Dos modelos, no uno

El pipeline separa dos tareas que **no comparten modelo**. El usuario elige cada uno en su propio selector en el frontend:

- **Visión** (`proveedor`): lee la imagen del esquemático.
- **Razón** (`proveedor_razon`): planifica el armado y opera las tareas del chat. Es texto→JSON, nunca ve una imagen.

Ambos salen del mismo catálogo multi-proveedor (`providers/catalogo.py`, única fuente de verdad). Cada modelo declara sus `roles` (`vision`, `razon` o ambos), que deciden en qué selector aparece.

### Pipeline de generación del circuito

```
Imagen del esquemático
  → Extractor Agent (modelo de VISIÓN)   → netlist JSON (componentes + conexiones)
  → topologia.py (union-find, sin IA)    → resuelve qué pines DEBEN conectarse (nets)
  → Planner Agent (modelo de RAZÓN)      → propone geometría (fila/columna/cables) + texto de cada paso
  → validador.py                         → simula la física y rebota errores al planner (reintento)
  → Instrucciones interactivas en el canvas
```

El posicionamiento **no es determinista**: el LLM *propone* dónde va cada componente y qué cables usar; `validador.py` verifica esa propuesta contra los nets reales (cortocircuitos, colisiones en el mismo hueco, rieles no conectados, nodos sin unir) y reinyecta los errores concretos en el prompt para que el modelo se corrija, hasta un máximo de reintentos.

### Chat Agent (v2)

Cada mensaje pasa por el modelo de razón usando **function-calling** (`tool_choice="required"`): el modelo **siempre** elige una de cuatro acciones, y de paso diagnostica el tipo de interacción en la misma llamada:

- **responder** → responde la pregunta sobre el circuito (solo texto).
- **modificar_netlist** → agrega/quita/reconecta un componente y **regenera todo el plan**.
- **modificar_posiciones** → mueve un componente (sin cambiar la topología eléctrica) vía un override numérico o una instrucción libre, y regenera las coordenadas.
- **proponer_alternativa** → pide al planner una distribución **distinta** a la actual (pedidos abiertos tipo "arma diferente").

Todas las rutas que tocan el circuito devuelven `instrucciones_actualizadas` para que el frontend refresque canvas y pasos en tiempo real.

### Cuentas y datos

Registro/login con JWT + Argon2, sesiones persistentes por usuario (netlist, instrucciones, imagen, historial de chat, métricas), sesiones **compartibles** por token, y *rate limiting* por usuario/IP para proteger el presupuesto de tokens y el servidor.

### Biblioteca de materiales y Retos (fusión)

Dos features que no existían en el pipeline original, portadas del fork de producto y adaptadas a este stack (auth JWT+Argon2, Postgres/SQLAlchemy, Supabase Storage):

- **Biblioteca de materiales** (`/materiales/*`): cualquier usuario autenticado puede subir PDFs/guías/datasheets a una biblioteca compartida, con portada auto-generada (PyMuPDF) para PDFs. El archivo vive en un **bucket privado** de Supabase Storage — se sirve proxied con JWT, no con una URL pública, a diferencia del fork original que lo guardaba en disco local (que no sobrevive un redeploy). También incluye tutoriales de electrónica generados por IA para cualquier componente, con chat de seguimiento.
- **Retos gamificados** (`/retos/diario`): un quiz corto generado por IA (opción múltiple + relacionar), con dificultad ajustada al nivel del usuario. Se genera al vuelo, sin persistencia — a propósito no se muestran rachas ni XP acumulado inventados, como sí hacía el fork original sin respaldo real en el backend.

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Modelos | Catálogo multi-proveedor: **OpenAI · Google Gemini · NVIDIA NIM · Ollama** (local). Un solo cliente OpenAI-compatible (`MLLMProvider`) sirve a todos. |
| Framework de agentes | LangGraph |
| Backend | FastAPI + Uvicorn (Python 3.13) |
| Base de datos | PostgreSQL (Supabase, *Session pooler*) vía SQLAlchemy + Alembic |
| Autenticación | JWT (PyJWT) + hashing Argon2 |
| Cifrado de keys | Fernet (`cryptography`) |
| Almacenamiento de archivos | Supabase Storage (bucket público para esquemáticos de ejemplo, privado para materiales subidos por usuarios) |
| Frontend | React 19 + Vite + TypeScript |
| Canvas interactivo | Konva.js + React-Konva |
| Estilos | Tailwind CSS v4 |

---

## Estructura del proyecto

```
Paralelo/
├── Backend/
│   ├── agents/
│   │   ├── estado.py                  # EstadoGlobal + enum ModoInteraccion (los 5 tipos)
│   │   ├── extractor_agent.py         # imagen → netlist (grafo LangGraph, modelo de visión)
│   │   ├── topologia.py               # union-find: qué pines DEBEN conectarse (sin IA)
│   │   ├── planner_agent.py           # netlist + nets → geometría + texto de cada paso (modelo de razón)
│   │   ├── validador.py               # simula la física y rebota errores al planner
│   │   ├── agent_chat.py              # responde preguntas ("responder")
│   │   ├── chat_agent_v2.py           # orquestador del chat (elige y ejecuta la acción)
│   │   ├── herramientas_chat.py       # las 4 acciones en formato function-calling
│   │   ├── deteccion_interaccion.py   # diagnostica el tipo de interacción por turno
│   │   ├── verbosidad.py              # reglas de redacción por nivel del usuario
│   │   └── seguridad.py               # sanitiza/delimita input (mitigación de prompt injection)
│   ├── providers/
│   │   ├── catalogo.py                # única fuente de verdad de modelos y roles
│   │   ├── base.py · mllm_provider.py # interfaz + cliente OpenAI-compatible único
│   │   ├── disponibilidad_usuario.py  # qué modelos puede usar la key del usuario
│   │   └── cifrado_keys.py            # Fernet para las API keys guardadas
│   ├── db/                            # database.py + models.py (Usuario, Sesion, ChatMensaje, MaterialBiblioteca)
│   ├── alembic/                       # migraciones del esquema
│   ├── schemas/                       # netlist.py, materiales.py, retos.py
│   ├── auth.py                        # JWT + Argon2
│   ├── rate_limit.py                  # límites por usuario/IP (en memoria del proceso)
│   ├── metricas.py                    # tokens, costos y cuotas por proveedor
│   ├── biblioteca_esquematicos.py     # esquemáticos de ejemplo (Supabase Storage, bucket público)
│   ├── materiales.py                  # biblioteca de materiales subidos por usuarios (Supabase Storage, bucket privado)
│   ├── retos.py                       # reto diario gamificado
│   └── main.py                        # aplicación FastAPI (endpoints)
└── Frontend/
    └── src/
        ├── api/          # clientes HTTP: auth, analizar, planificar, chat, sesiones, proveedores, materiales, retos
        ├── ui/           # pantallas: Auth, EncuestaNivel, VistaPrincipal, ChatPanel, SelectorModelo (×2), Biblioteca, Retos, RetoDiario, etc.
        ├── circuit/      # layout de la protoboard + código de colores de resistencias
        └── components/   # Protoboard (Konva), vistas de instrucciones/JSON, galería de componentes
```

---

## Requisitos previos

- **Python 3.13**
- **Node.js 20+** (para Vite)
- Al menos una **API key** de un proveedor (OpenAI, Gemini o NVIDIA). Gemini tiene tier gratuito: <https://aistudio.google.com/app/apikey>
- Una base de datos **PostgreSQL**. Lo más simple: cuenta gratuita de **Supabase** (<https://supabase.com>) — usar siempre la connection string del **Session pooler** (ver nota en el `.env.example`).
- Si vas a usar la Biblioteca de materiales: un bucket **privado** en Supabase Storage llamado `materiales-biblioteca`, y la **Service Role Key** del proyecto (nunca la anon key) — ver `Backend/.env.example`.

---

## Instalación y ejecución (local)

### Backend

```bash
cd Backend

# 1. Entorno virtual
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# 2. Dependencias
pip install -r requirements.txt

# 3. Variables de entorno (ver sección siguiente)
cp .env.example .env            # luego rellena el .env

# 4. Crear las tablas en la base de datos
alembic upgrade head

# 5. Correr el servidor
uvicorn main:app --reload
```

El backend queda en <http://localhost:8000>. La documentación interactiva está en <http://localhost:8000/docs>.

#### Pruebas del backend

Las pruebas (`Backend/tests/`) necesitan una base PostgreSQL **de prueba** aparte — cada prueba vacía las tablas, así que nunca uses la de Supabase:

```bash
pip install pytest
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/paralelo_test pytest
```

### Frontend

```bash
cd Frontend

npm install
cp .env.example .env            # VITE_API_URL apunta al backend (por defecto localhost:8000)
npm run dev
```

El frontend queda en <http://localhost:5173>.

---

## Variables de entorno

### Backend — `Backend/.env`

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `OPENAI_API_KEY` · `GEMINI_API_KEY` · `NVIDIA_API_KEY` | Al menos una | Claves de los proveedores del catálogo. |
| `DATABASE_URL` | Sí | Connection string de PostgreSQL/Supabase (**Session pooler**, no la directa). |
| `JWT_SECRET_KEY` | Sí | Secreto para firmar los tokens (ver abajo). |
| `API_KEYS_SECRET` | Sí | Llave Fernet que cifra las API keys que los usuarios guardan en su cuenta. |
| `JWT_EXPIRA_MINUTOS` | No | Vida del token en minutos (por defecto `10080` = 7 días). |
| `FRONTEND_URL` | Prod | Dominio del frontend desplegado para CORS. Si se omite, solo se acepta localhost. |
| `SUPABASE_URL` · `SUPABASE_ANON_KEY` | No | Esquemáticos de ejemplo (bucket público, solo lectura). Sin ellas, esa vista queda vacía (no rompe la app). |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Biblioteca de materiales subidos por usuarios (bucket **privado**, lectura/escritura). Sin ella, `/materiales/subir` responde 503 en vez de fallar a medias. |
| `OLLAMA_BASE_URL` · `OLLAMA_MODEL` | No | Solo si corres un modelo local con Ollama en la misma máquina que el backend. |

Genera los secretos con:

```bash
python -c "import secrets; print(secrets.token_urlsafe(64))"                              # JWT_SECRET_KEY
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())" # API_KEYS_SECRET
```

> El archivo `.env` **nunca** se sube a Git — contiene secretos.

### Frontend — `Frontend/.env`

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL del backend (por defecto `http://localhost:8000`). |

> En Vite, las variables **deben** empezar con `VITE_` y quedan **expuestas** en el navegador. Nunca pongas secretos aquí.

---

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/proveedores` · `/biblioteca-esquematicos` | Catálogo de modelos · esquemáticos de ejemplo. |
| `POST` | `/auth/registro` · `/auth/login` | Crear cuenta / iniciar sesión (devuelven JWT). |
| `GET` | `/auth/me` · `/auth/modelos-disponibles` | Usuario autenticado · modelos habilitados para sus keys. |
| `PATCH` | `/auth/perfil` · `/auth/contrasena` · `/auth/api-keys` · `/auth/nivel` | Actualizar perfil, contraseña, API keys propias y nivel. |
| `POST` | `/analizar` · `/planificar` | Imagen → netlist · netlist → instrucciones. |
| `POST` | `/chat` | Chat sobre el circuito (streaming SSE). |
| `POST` `GET` `PATCH` `DELETE` | `/sesiones` · `/sesiones/{id}` | CRUD de sesiones guardadas. |
| `POST` `GET` | `/sesiones/{id}/compartir` · `/sesiones/compartidas/{token}` | Compartir e importar sesiones por token. |
| `POST` `GET` `DELETE` | `/materiales/subir` · `/materiales` · `/materiales/{id}` | Subir, listar y eliminar materiales de la biblioteca. |
| `GET` | `/materiales/portadas/{id}` · `/materiales/descargar/{id}` | Portada (pública) · archivo (requiere JWT). |
| `GET` `POST` | `/materiales/tutorial/{componente}` · `/materiales/tutorial-chat` | Tutorial de IA por componente · chat de seguimiento. |
| `GET` | `/retos/diario` | Reto diario gamificado, generado por IA según el nivel del usuario. |

Todos los endpoints (excepto registro/login y los públicos de arriba) requieren un token JWT en el header `Authorization: Bearer <token>`.

---

## Equipo

Proyecto original — Programa Delfín, Universidad EAFIT:

| Nombre | Rol |
|--------|-----|
| Cristopher Rojas ([DanteXhunter](https://github.com/DanteXhunter)) | Backend · agentes |
| Diego Rojas ([DiegoRojas8509](https://github.com/DiegoRojas8509)) | Frontend · canvas |

Biblioteca de materiales y Retos, adaptados de la implementación de [Saul0604](https://github.com/Saul0604).
