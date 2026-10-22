# Propuesta de diseño — friend-ski-trip

Basada en `functional-requirements.md`. Objetivo: la mínima complejidad que cubra los requisitos.

## 1. Análisis de requisitos y supuestos

| # | Requisito | Interpretación / supuesto propuesto |
|---|---|---|
| R1 | Admin crea/edita/borra viajes | Pantalla `/admin` protegida por contraseña. |
| R2 | Viaje = título, fecha, descripción, nº viajeros, foto | **Fecha → rango `start_date` / `end_date`** (noches de alojamiento) **+ `ski_days`** (días de forfait). Son distintos porque hay días que son solo de viaje. El admin define `ski_days` al crear el viaje. |
| R3 | Un único admin hardcode | Usuario/contraseña en **variables de entorno** (`ADMIN_USER`, `ADMIN_PASSWORD`), no literal en el código, para no subir secretos al repo. |
| R4 | Landing selecciona viaje (auto si hay uno) | `/` lista viajes; si hay uno, redirige directamente. |
| R5 | Elegir tu nombre o añadir uno nuevo | Sin autenticación: "participante" = nombre por viaje. Se recuerda en `localStorage`. Solo sirve para saber quién añadió cada destino/alojamiento. |
| R6–R11 | Viaje → destinos → alojamientos | Modelo jerárquico simple (ver §3). |
| R10 | Destino = link Maps, tiempo en coche desde Gijón, precio forfait | Además un **nombre** del destino (lo extrae la IA) para poder mostrarlo. Forfait = **precio por persona para `trip.ski_days` días**. |
| R11 | Alojamiento = descripción, camas, habitaciones, baños, distancia a pistas, precio por persona | Se guarda el **precio total de la estancia** y el **precio por persona se calcula** como `total / nº viajeros del viaje` ✅ confirmado. Si cambia el nº de viajeros, todo se recalcula solo. |
| — | Editar / borrar destinos y alojamientos | ✅ **Cualquier participante** puede corregir y borrar. |
| — | Coste del trayecto en coche | ✅ Solo se muestra el tiempo; no se suma al precio. |
| — | Idioma / dominio | ✅ Solo español. Dominio: `ski-friends.pandiello.dev`. |
| R12 | Precio total por combinación | `forfait_pp + alojamiento_pp`, por alojamiento, ordenado de más barato a más caro. |
| R15 | Resumen en página del viaje | Por destino: nombre, tiempo en coche, rango de precio total (min–max) y nº de alojamientos. |
| R16–R18 | Extracción en background con Claude | Ver §5. ✅ **Ajustado tras el spike:** el destino se saca del link de Maps sin IA y Claude solo extrae el forfait. El alojamiento admite una **captura de pantalla** opcional para el precio. **Los campos extraídos son editables** para corregir errores. |

**Fuera de alcance** (no está en los requisitos): votaciones, gastos, chat, notificaciones, coste del trayecto (gasolina y peajes), multiidioma.

## 2. Arquitectura

```
                 ┌──────────────── Coolify (Hetzner) ────────────────┐
 móvil (browser) │  app (1 contenedor)                 PostgreSQL     │
 ───────────────▶│  ├─ sirve el SPA estático (frontend)  (recurso      │
                 │  ├─ /api/*  (backend)        ◀──────▶  Coolify)     │
                 │  └─ worker de extracción (in-process) ──▶ Claude API│
                 └────────────────────────────────────────────────────┘
```

- **Monorepo, un solo despliegue.** El backend sirve el build del frontend. Un contenedor + una base de datos en Coolify: sin CORS, sin dos dominios, sin proxy extra.
- **Sin colas ni Redis.** El trabajo en background es un bucle en el propio proceso del backend que recoge los registros `pending` de la base de datos. Como el estado vive en Postgres, sobrevive a reinicios (al arrancar se reanudan los `pending` / `processing`).
- **Fotos en Postgres (`bytea`)**, redimensionadas en el cliente (~1600 px, JPEG, menos de 500 KB). Con un solo viaje y una foto por viaje no hace falta almacenamiento de objetos ni volúmenes, y hay una única cosa que respaldar.

## 3. Modelo de datos

```
trips
  id              uuid pk
  title           text
  description     text
  start_date      date
  end_date        date             -- noches = end_date - start_date
  ski_days        int              -- días de forfait (<= días del viaje)
  travelers       int              -- nº viajeros, divisor del precio por persona
  photo           bytea null
  photo_mime      text  null
  created_at      timestamptz

participants
  id              uuid pk
  trip_id         fk trips  (on delete cascade)
  name            text
  unique (trip_id, lower(name))

destinations
  id              uuid pk
  trip_id         fk trips  (cascade)
  maps_url        text
  forfait_url     text null        -- opcional
  forfait_screenshot bytea null     -- captura opcional con el precio (+ forfait_screenshot_mime)
  name            text null         -- del link de Maps
  lat, lng        double null       -- del link de Maps
  drive_minutes   int  null         -- ruta calculada desde Gijón
  forfait_price   numeric null      -- por persona, para trip.ski_days días
  forfait_days    int  null         -- ski_days con el que se extrajo (detectar desfase)
  status          enum(pending, processing, done, failed)
  error           text null
  created_by      fk participants null
  created_at      timestamptz

accommodations
  id              uuid pk
  destination_id  fk destinations (cascade)
  source_url      text              -- booking.com / airbnb
  name            text null
  description     text null
  beds            int  null
  bedrooms        int  null
  bathrooms       int  null
  distance_km     numeric null      -- distancia a pistas
  total_price     numeric null      -- estancia completa
  image_url       text  null        -- primera foto del anuncio (JSON-LD), enlazada
  screenshot      bytea null        -- captura opcional; se conserva para poder reintentar
  screenshot_mime text  null
  status, error, created_by, created_at  (igual que destinations)
```

Valores derivados que se calculan al leer, sin guardarlos:
- `accommodation.price_pp = total_price / trip.travelers`
- `combo_pp = destination.forfait_price + accommodation.price_pp`
- resumen de destino: `min(combo_pp)`, `max(combo_pp)`, `drive_minutes`

Si el admin cambia las fechas o `ski_days` de un viaje, los precios ya extraídos quedan desfasados (`forfait_days != trip.ski_days`). La UI lo marca con un aviso y ofrece "Reintentar" para volver a extraer.

## 4. Pantallas (mobile-first)

| Ruta | Contenido |
|---|---|
| `/` | Lista de viajes (tarjetas con foto). Si hay uno solo, redirige. |
| `/t/:tripId/join` | "¿Quién eres?": lista de nombres + "Soy nuevo" (input). Se salta si ya hay un participante en `localStorage`. |
| `/t/:tripId` | Cabecera con foto, fechas, días de esquí, descripción y nº viajeros. Tarjetas de destino: nombre, 🚗 tiempo, 💶 rango €/persona y nº de alojamientos. Botón **+ Destino**. |
| `/t/:tripId/new-destination` | Link de Google Maps y, opcionales, link y/o captura del precio del forfait. Al enviar se crea en estado `pending` y vuelve al viaje. |
| `/d/:destinationId` | Info del destino (link a Maps y al forfait, precio del forfait, días). Lista de alojamientos con camas, habitaciones, baños, distancia, €/persona del alojamiento y **total €/persona**, ordenada por total. Botón **+ Alojamiento**. |
| `/d/:destinationId/new-accommodation` | Link de booking.com o Airbnb, más una **captura opcional** del anuncio con el precio (input de imagen; en el móvil abre la galería). |
| editar destino / alojamiento | Formulario con los campos extraídos, para corregirlos. Botón **Borrar** (con confirmación en la propia UI). |
| `/admin` | Login, y después CRUD de viajes (formulario con subida de foto). |

Mientras un registro está `pending` o `processing`, su tarjeta muestra "Extrayendo datos…" y el frontend consulta la API cada pocos segundos. Si queda en `failed`, muestra el error con dos opciones: "Reintentar" o "Rellenar a mano".

## 5. Extracción con Claude

Flujo común:
1. `POST /api/...` crea el registro con `status = pending` y responde enseguida.
2. El worker lo marca como `processing` y llama a la API de Claude con:
   - la herramienta de servidor **`web_fetch`** (Anthropic descarga la URL; no hace falta scraping propio), más `web_search` para el destino;
   - **structured outputs** (`output_config.format` con un JSON schema) para obtener exactamente los campos del modelo;
   - contexto del viaje: fechas, nº de viajeros y origen Gijón.
3. Valida el JSON (zod), guarda los campos y pone `done`; si algo falla, `failed` con el mensaje de error.

**Resultado del spike (2026-10-21)**, descargando las páginas directamente:
- **Airbnb**: responde 200 y el HTML trae nombre, descripción y "N dormitorios · N camas · N baños". **El precio no está**: se carga después con JavaScript.
- **Booking**: responde 202 con un challenge anti-bot (AWS WAF), sin contenido.
- **Google Maps**: los links `maps/dir/...` ya contienen el nombre del destino y sus coordenadas (`!1d<lng>!2d<lat>`). No hace falta descargar nada.
- Pendiente: confirmar con la key cómo se comporta el `web_fetch` de Claude. Previsiblemente igual, porque no ejecuta JavaScript.

**Destino** (sin IA, salvo el forfait)
- El backend parsea el link de Maps para sacar nombre y coordenadas. Si es un link corto (`maps.app.goo.gl/...`), primero sigue la redirección.
- El tiempo en coche desde Gijón se calcula con un API de rutas a partir de las coordenadas: OSRM público (sin key) o, si se queda corto, OpenRouteService (gratis con key). En el spike salió Gijón → Saint-Lary 624 km / 7 h 04 min y Gijón → Formigal 586 km / 7 h 06 min. Algo más alto que Google; es una estimación y el campo es editable.
- Claude obtiene el precio del forfait desde `forfait_url` y/o la captura para `trip.ski_days` días, en las fechas del viaje por si hay temporada alta o baja. Sin ninguno de los dos, el precio queda pendiente para ponerlo a mano.
  - Spike con N'PY (Piau-Engaly): la página responde 200 y las tablas de precios vienen en el HTML (adulto, niño, estudiante, senior × "Public" / "No Souci"). Ejemplo: adulto 4 días "Public" = 180 €.
  - Por eso el backend descarga la página, la reduce a texto (unos 9.000 caracteres, céntimos de coste) y se la pasa a Claude con structured outputs, sin necesitar `web_fetch`. Se le pide el **precio adulto, tarifa pública, para `ski_days` días**.
  - Si la página no se puede descargar o no trae precios (webs que los cargan con JavaScript), queda "Pendiente" y se rellena a mano.

**Alojamiento** (link + captura opcional)
- El backend intenta descargar la página. Si hay contenido útil (Airbnb), se lo pasa a Claude.
- Si el usuario adjuntó una captura del anuncio, también se envía a Claude como imagen (visión). De ahí sale sobre todo el **precio total** y los datos que falten (todo el anuncio en el caso de Booking).
- Se le dan a Claude las fechas y el nº de noches del viaje para que distinga el precio por noche del total.
- La captura se guarda en la base de datos y se conserva, para que "Reintentar" no pierda el precio. A un alojamiento ya creado se le puede subir una captura desde su pantalla de edición.
- De la página (Airbnb) se usan también las etiquetas meta y el JSON-LD: nombre, descripción, coordenadas y la primera foto, que sirve de miniatura.
- El precio total se calcula en código: si es por noche, se multiplica por las noches del viaje; si es total, se comprueba que cubra esas noches.
- Distancia a pistas: la que mencione el anuncio. Si no menciona ninguna, la distancia en línea recta desde las coordenadas del anuncio al punto del destino en Maps (aproximada).
- Booking sin captura: nombre aproximado a partir de la URL.
- Lo que no se consiga extraer queda vacío y se rellena a mano. Sin precio, el alojamiento sale "sin precio" en los totales.
- Descartado: un navegador headless (Playwright) en el servidor. Añade unos 400 MB a la imagen y Booking suele bloquearlo igualmente.

**Modelo:** `claude-haiku-5-5` (configurable con `CLAUDE_MODEL`), con effort `low`. Cada extracción cuesta menos de 0,001 $. Para que Haiku sea fiable, el esquema de salida pone primero la evidencia (fila o texto literal) y después el valor, y el código valida el resultado (días, tipo de tarifa, noches).

**Abuso:** cualquiera con el link puede crear destinos y alojamientos, y eso dispara llamadas a Claude. Mitigación sencilla: un rate limit por IP en los endpoints de creación y un tope de llamadas diarias.

## 6. API

```
GET    /api/trips                         lista (sin foto)
GET    /api/trips/:id                     detalle + resumen de destinos
GET    /api/trips/:id/photo               imagen
GET    /api/trips/:id/participants
POST   /api/trips/:id/participants        { name }  (devuelve el existente si coincide)

POST   /api/trips/:id/destinations        multipart: mapsUrl, forfaitUrl?, forfaitScreenshot?, participantId?
POST   /api/destinations/:id/forfait-screenshot  multipart: forfaitScreenshot (re-extrae)
GET    /api/destinations/:id              detalle + alojamientos + combos
PATCH  /api/destinations/:id              corrección manual
DELETE /api/destinations/:id              (cascade a alojamientos)
POST   /api/destinations/:id/retry

POST   /api/destinations/:id/accommodations   multipart { url, participantId, screenshot? }
PATCH  /api/accommodations/:id
DELETE /api/accommodations/:id
POST   /api/accommodations/:id/retry

POST   /api/admin/login                   cookie de sesión firmada (httpOnly)
POST   /api/admin/trips                   multipart (con foto)
PUT    /api/admin/trips/:id
DELETE /api/admin/trips/:id
```

El borrado es definitivo (sin papelera). Si alguna vez molesta, la mejora sencilla es un borrado lógico con `deleted_at`.

## 7. Tecnología

Criterio: **un solo lenguaje (TypeScript)** en todo el monorepo, con tipos y validaciones compartidos entre frontend y backend, y pocas piezas.

| Parte | Elección | Por qué |
|---|---|---|
| Monorepo | **pnpm workspaces** (`apps/web`, `apps/api`, `packages/shared`) | Sin Turborepo ni Nx: con 3 paquetes no hace falta. |
| Frontend | **React + Vite + TypeScript + Tailwind CSS**, React Router, TanStack Query (polling y caché) | SPA estática, ligera y mobile-first. Manifest de PWA opcional para "añadir a pantalla de inicio". |
| Backend | **Node 24 + Hono** (TypeScript ejecutado directamente con el *type stripping* de Node, sin paso de build) | Framework mínimo y rápido, ideal para una API REST pequeña. Sirve también los estáticos del frontend. |
| ORM / migraciones | **Drizzle ORM + drizzle-kit** | Esquema en TypeScript, SQL explícito y migraciones versionadas en el repo. |
| Validación | **zod** en `packages/shared` | Los mismos schemas para formularios, API y la salida de Claude. |
| IA | **@anthropic-ai/sdk** (`web_fetch`, `web_search`, structured outputs) | Requisito. |
| Base de datos | **PostgreSQL 18** | Recurso nativo de Coolify en producción; la misma imagen `postgres:18` en el `docker-compose` local. |
| Despliegue | Un `Dockerfile` multi-stage en la raíz (build web + api → imagen Node) | Coolify construye desde el repo y sirve la app en `https://ski-friends.pandiello.dev` (TLS automático). Las migraciones se aplican al arrancar. |

Alternativa descartada: Next.js o SvelteKit full-stack. Sería igual de simple, pero mezcla frontend y backend en un único paquete, y queremos la separación en partes del monorepo.

### Estructura del repo

```
apps/
  web/            React SPA
  api/            Hono: rutas, worker de extracción, cliente Claude
    src/db/       schema Drizzle + migraciones
packages/
  shared/         schemas zod + tipos
docker-compose.yml   postgres:18 (+ app opcional) para local
Dockerfile
.env.example         DATABASE_URL, ANTHROPIC_API_KEY, ADMIN_USER, ADMIN_PASSWORD, SESSION_SECRET
docs/
```

## 8. Plan de trabajo sugerido

1. **Spike de extracción**: script con 3–4 links reales de Booking, Airbnb, Maps y forfaits para validar `web_fetch` y elegir modelo. Es lo que más riesgo tiene.
2. Esqueleto del monorepo, docker-compose, esquema de la base de datos y migraciones.
3. Admin: CRUD de viajes.
4. Landing, selección de participante y página del viaje.
5. Destinos y alojamientos con extracción en background y edición manual.
6. Dockerfile y despliegue en Coolify.

## 9. Decisiones cerradas

1. Viaje con rango de fechas y `ski_days` independiente, porque hay días que son solo de viaje.
2. Precio por persona del alojamiento = `total / nº viajeros`.
3. Cualquier participante puede corregir y borrar destinos y alojamientos.
4. Solo se muestra el tiempo en coche; no se calcula coste del trayecto.
5. Solo español. Dominio `ski-friends.pandiello.dev`.
