# referrals-dashboard

## Descripción

Dashboard interno de PropHero para gestionar referrals entre clientes. Permite ver el listado completo de referrals, filtrarlos por múltiples criterios, ver el detalle de cada uno y editarlos (estado, pagos, descuentos, datos fiscales del referrer). Incluye exportación a Excel con selección de columnas.

## Contexto

Prophero — app interna. **Auth:** login con Google restringido al dominio `@prophero.com`; el front envía el ID token en `Authorization: Bearer` y n8n valida el JWT server-side (migrado desde API key en header, jun 2026).

> **Alcance de la fase actual:** el **Portal del Cliente** (app separada para referrers externos, WF-C) **NO se incluye y está OFF** por ahora — no se usa. Queda fuera del alcance de la auth y de la rotación de secret actuales.

## Stack usado en este proyecto

- **Frontend:** Vite + React 19 (JSX, sin TypeScript) + Tailwind CSS v3
- **Routing:** React Router DOM v7
- **Data fetching:** TanStack React Query v5 con `staleTime: Infinity`, `gcTime: Infinity` y persistencia en localStorage via `@tanstack/react-query-persist-client`
- **Charts:** Recharts
- **Export:** `xlsx` (SheetJS) — genera .xlsx client-side sin llamadas externas
- **Backend/API:** n8n webhooks (no hay backend propio). Variables de entorno: `VITE_N8N_BASE_URL` + `VITE_GOOGLE_CLIENT_ID` + `VITE_N8N_ENV_SUFFIX` (ya no se usa `VITE_API_KEY` — el front manda el JWT de Google y n8n lo valida)
- **Deploy:** Vercel. Dev/prod se resuelve con `VITE_N8N_ENV_SUFFIX` por scope de Vercel: **Production** = `-prod` (webhooks prod → HubSpot prod `26806608`), **Preview + Development** y local = vacío (webhooks dev → HubSpot sandbox `146997468`). Mismo host (`VITE_N8N_BASE_URL`) para ambos; sólo cambia el sufijo del path. Así `main` pega a prod y los branches de feature a dev, sin `if` de entorno en el código.

## Colores del sistema de diseño

Definidos en `tailwind.config.js`:
- `primary`: `#101542` (azul oscuro — header, botones principales)
- `secondary`: `#2E6DA4` (azul medio — links, foco, botón fiscal)
- `background`: `#F0F4F8` (gris claro — fondo de página)

## Estado actual

App funcional y deployada. El dashboard muestra lista de referrals con filtros, KPIs, **columnas ordenables**, paginación (PAGE_SIZE = 20) y exportación a Excel. La columna/selector que antes se llamaba "Unit" ahora se muestra como **"Program"** en la UI (la variable interna sigue siendo `unit`).

La página de detalle es **read-only** respecto a estados y fechas (se eliminó el formulario de edición de estados — refactor jun 2026). Lo único editable es el bloque **"Referrer fiscal data"** (IBAN / NIF / Address), que al guardar **relanza el pago al referrer** vía `FISCAL_UPDATE` (con `ConfirmDialog` y guard: deshabilitado si `referrer_payment_status === 'paid'` o falta `referrer.id`). Incluye navegación entre referrals del mismo referrer.

## Endpoints n8n

Definidos como constantes en `src/api/hubspot.js`. El path real lleva el sufijo `VITE_N8N_ENV_SUFFIX` (`-prod` en Production, vacío en dev/local):

| Constante        | Path base (sin sufijo)                      | Uso                                        |
|------------------|---------------------------------------------|--------------------------------------------|
| `LIST`           | `/webhook/dashboard-referrals-list`         | Lista de referrals (paginada server-side)  |
| `DETAIL`         | `/webhook/dashboard-referral-detail`        | Detalle de un referral por ID              |
| `KPIS`           | `/webhook/dashboard-referrals-kpis`         | Métricas agregadas                         |
| `FISCAL_UPDATE`  | `/webhook/dashboard-update-referrer-fiscal` | Guarda datos fiscales y relanza pago       |

Todos los endpoints reciben POST con `Authorization: Bearer <ID token de Google>` en header. n8n valida el JWT server-side (sub-workflow `auth-guard-google-jwt`) antes de procesar. (Antes usaban `x-api-key`; migrado en jun 2026.)

### Contrato de la lista (d1) — paginación server-side

El endpoint d1 pagina server-side: acepta `page` (default 1) y `pageSize` (default 20, **cap 200**) y responde `{ referrals, total, page, pageSize, totalPages }` (mismo shape en página vacía). Filtra server-side **sólo** `unit`, `referral_status` (status) y `search` (full-text `query` de HubSpot). **No** filtra server-side `referrer_payment_status`, `referido_discount_status`, `dateFrom`/`dateTo`, ni hace group-by-referrer.

> **Path A (bridge, cutover prod jun 2026):** el front manda `page:1, pageSize:200` y conserva el modelo client-side (filtrado / orden / group-by-referrer / export / KPIs sobre el set completo). Es equivalente a la UX previa, con el mismo cap de 200. El refactor server-side completo queda para cuando el volumen supere 200 (ver "Próximos pasos").

> **`dashboard-referral-update` (wf-d3) dado de baja (cutover jun 2026):** era el endpoint de escritura del viejo formulario de edición. Al pasar el detalle a read-only quedó sin call sites; se **desactivó en n8n** (`active: false`, POST → 404) y se eliminó del front la función `updateReferral()` + la constante `UPDATE`. Si el detalle vuelve a ser editable, hay que reactivar wf-d3 **con validación de valores (enums)** antes de reintroducir `updateReferral()` — coordinar con el lado n8n.

## Estructura de datos del referral (objeto en lista)

```js
{
  referralHsId,              // ID interno HubSpot (usado como key de tabla y para routing)
  referral_id,               // ID legible (ej: "REF-0001")
  unique_id,                 // ID único alternativo (viene del detalle, no de la lista)
  unit,                      // "SP" | "VH"
  referral_status,           // "created" | "pending" | "paid"
  referrer_payment_status,   // "pending" | "paid"
  referrer_payment_date,
  referido_discount_status,  // "not_applicable" | "pending" | "applied"
  referido_discount_date,
  referrer_amount,
  referido_amount,
  created_date,
  referrer: { firstname, lastname, referrer_code, total_referrals },
  referido: { firstname, lastname },
  deal:     { dealname }
}
```

## Ciclo de estados de un referral

| Evento                                    | `referido_discount_status` | `referral_status` | `referrer_payment_status` |
|-------------------------------------------|----------------------------|-------------------|---------------------------|
| Referral creado (Flujo 02)                | `pending`                  | `created`         | `pending`                 |
| 1ª factura BC asociada al deal → WF-E     | `applied`                  | **`paid`**        | `pending`                 |
| 2ª factura BC asociada al deal → WF-E     | `applied`                  | `paid`            | **`paid`**                |

**WF-E** (`lo0kZ6zxhgA4gxOP`) se dispara por webhook de HubSpot al crear un objeto BC invoice (tipo `2-192879282`). Determina si es la 1ª o 2ª factura leyendo `referido_discount_status`: "pending" → descuento del referido; "applied" → pago al referrer.

**Flujo 02** (`DpC60Lfmj8xJ1Jhx`) crea el referral con todos los campos en "pending"/"created". **No** setea `referido_discount_status = "applied"` — eso lo hace WF-E cuando llega la factura BC.

## Archivos clave

| Archivo                                 | Descripción                                                   |
|-----------------------------------------|---------------------------------------------------------------|
| `src/api/hubspot.js`                    | Todas las llamadas a n8n. Constantes de endpoints.            |
| `src/lib/referralFilters.js`           | Lógica pura extraída y testeada: `filterReferrals`, `sortReferrals`, `groupByReferrer` (+ `.test.js`) |
| `src/pages/Dashboard.jsx`              | Lista principal con filtros, KPIs, orden por columna, paginación, botón Export |
| `src/pages/ReferralDetail.jsx`         | Vista read-only del referral + edición fiscal (relanza pago) + navegación entre siblings |
| `src/components/ReferralTable.jsx`     | Tabla de referrals (presentacional)                           |
| `src/components/ExportModal.jsx`       | Modal de exportación Excel con selección de columnas          |
| `src/components/StatusBadge.jsx`       | Badge de estado (created/paid/pending/applied)                |
| `src/components/KPICard.jsx`           | Tarjeta de métrica en el header del dashboard                 |
| `src/hooks/useReferrals.js`            | React Query wrapper para la lista                             |
| `src/hooks/useReferralDetail.js`       | React Query wrapper para el detalle                           |
| `src/hooks/useKPIs.js`                 | React Query wrapper para las métricas                         |
| `tailwind.config.js`                   | Colores del sistema de diseño                                 |

## Decisiones tomadas

- **Sin backend propio:** toda la lógica de negocio vive en n8n. El frontend solo consume y muestra.
- **staleTime: Infinity + gcTime: Infinity + localStorage persister:** los datos no se refrescan solos y sobreviven page reloads; hay botón manual "Refresh" para evitar llamadas innecesarias a n8n.
- **Filtrado + orden 100% client-side (Path A bridge):** el front pide la lista con `page:1, pageSize:200` (ver "Contrato de la lista (d1)") y trae el set completo del unit en una página (⚠️ cap server-side de 200); el filtrado por texto/estado/pago/descuento/fecha y el ordenamiento por columna (`sortReferrals`, default `fecha desc`) se hacen en el frontend sobre esos datos. La lógica vive en `src/lib/referralFilters.js` (extraída de los componentes y testeada). Aunque d1 sabe filtrar `unit/status/search` server-side, el front **no** delega esos filtros para no mezclar con los que sólo existen client-side.
- **Sufijo de entorno (`VITE_N8N_ENV_SUFFIX`):** dev vs prod se resuelve con una sola env var de sufijo por scope de Vercel, no con bases distintos ni `if` en código (el host es el mismo). `src/api/hubspot.test.js` cubre el armado de URLs con sufijo vacío y `-prod`, y los params de paginación.
- **Detalle read-only:** se eliminó el formulario de edición de estados/fechas; el detalle solo muestra datos. La única mutación desde el detalle es guardar datos fiscales del referrer (`FISCAL_UPDATE`), que relanza el pago.
- **KPIs:** "Pending" se calcula client-side como referrals en estado `created` sobre el unit cargado; "Total Referrers" muestra `0` (no `—`) cuando está vacío; el botón "Refresh" refetchea KPIs **y** lista (antes solo la lista).
- **Paginación client-side:** PAGE_SIZE = 20, calculado sobre `displayRows` (agrupado por referrer) ya ordenado.
- **Dashboard agrupa por referrer:** `displayRows` muestra una fila por referrer (el referral más reciente). La exportación Excel usa `filtered` (todos los referrals individuales).
- **Auth de usuario:** login con Google restringido a `@prophero.com`; el front manda el ID token (`Authorization: Bearer`) y n8n valida el JWT server-side. (Antes: API key en header — migrado jun 2026.)
- **`referralHsId` como identificador de ruta:** `/referral/:id` usa el ID interno de HubSpot.
- **Siblings navigation:** `ReferralDetail` llama a `useReferrals()` directamente para obtener los referrals del mismo referrer y mostrar flechas de navegación en los extremos de la pantalla (fixed left/right).

## Próximos pasos

- **Cap de 200 referrals — Path A bridge (acción cuando el conteo se acerque a ~150):** hoy el front pide `page:1, pageSize:200` y hace todo client-side. HubSpot corta la búsqueda en 200, así que al superar 200 el front recibe **sólo los 200 más recientes** (`created_date` desc) y **trunca en silencio**: los más viejos no aparecen en lista, filtros, KPIs ni export. Único aviso visible: la línea de conteo muestra `total` real vs lo cargado (ej. *"X referrers · 200 referrals (filtrado de 230 total)"*). Dos formas de resolverlo:
  - **Opción 1 (interina, barata):** que d1 en n8n haga loop interno de la búsqueda HubSpot (paginando con `after`) y devuelva **todos** los referrals en una sola respuesta. El front no cambia; sube el cap a ~todo. Sirve hasta llegar a miles (respuesta única se vuelve pesada).
  - **Opción 2 (definitiva, Path B):** delegar paginación + filtros + orden + group-by-referrer al backend y que el front consuma páginas reales (`page/pageSize/totalPages`). El d1 ya pagina y filtra `unit/status/search`; **falta** en n8n: filtros server-side de `referrer_payment_status`, `referido_discount_status` y rango de fechas, y resolver el **group-by-referrer** server-side (una fila por referrer no mapea a una paginación de referrals crudos). Trabajo coordinado front + n8n.
  - Recomendación: al acercarse a ~150 hacer la Opción 1; dejar la 2 para cuando el volumen la justifique.
- **Error Handler de n8n inactivo (confirmar):** el workflow `Error Handler - Referrals system` (`WxJAnztFUmsIeeHM`, compartido dev+prod) quedó `active: false` tras el cutover (2026-06-24). Si un error workflow está inactivo, las alertas de error (Slack) **no se disparan**. Confirmar con el lado n8n si es intencional o si falta activarlo.
