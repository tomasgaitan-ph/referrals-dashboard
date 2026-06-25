# referrals-dashboard

## Descripción

Dashboard interno de PropHero para gestionar referrals entre clientes. Permite ver el listado completo de referrals, filtrarlos por múltiples criterios, ver el detalle de cada uno y **marcar manualmente el pago al referrer** desde el detalle. Incluye exportación a Excel con selección de columnas.

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
- `secondary`: `#2E6DA4` (azul medio — links, foco, botón "Mark as paid")
- `background`: `#F0F4F8` (gris claro — fondo de página)

## Estado actual

App funcional y deployada. El dashboard muestra lista de referrals con filtros, KPIs, **columnas ordenables**, paginación (PAGE_SIZE = 20) y exportación a Excel. La columna/selector que antes se llamaba "Unit" ahora se muestra como **"Program"** en la UI (la variable interna sigue siendo `unit`).

**Añadidos jun 2026 (pago manual):**
- **Badge "Ready to transfer":** estado de pago derivado (solo display) — cuando `referrer_payment_status==='pending'` y `referido_discount_status==='applied'`, el badge muestra "Ready to transfer" (amber, igual que pending) en vez de "Pending", en tabla y detalle. Lo calcula `referrerPaymentStatus()` en `referralFilters.js`; **no** toca el dato crudo ni los filtros.
- **KPI "Ready to Transfer":** cuenta de referrals applied + referrer-pending (cada uno = un pago de €500), client-side sobre el set cargado.
- **Filtro "Settlement period":** dropdown (This week / This month / Last month) que filtra por `deal.real_settlement_date` (semana lun–dom, mes calendario). `filterByPeriod()` en `referralFilters.js`. **Requiere** que d1 devuelva `deal.real_settlement_date` (ver "Contrato de la lista").
- **Detalle:** la card "Deal" muestra **Settlement date** y el **Stage** legible ("Pre-settlement" para `257909958`); la card "Referrer payment" muestra un **checklist** (✓/✗ pre-settlement, ✓/✗ settlement date) explicando por qué el botón está habilitado/bloqueado.
- **Recordatorio de Refresh:** popup global ([RefreshReminder](src/components/RefreshReminder.jsx), montado en `App` vía `GlobalRefreshReminder`, solo autenticado) que cada 30s recuerda apretar Refresh (los datos no se refrescan solos). El **"last updated"** del header del dashboard, del header del detalle y del popup salen todos del mismo helper `latestDataUpdate()` (`src/lib/lastUpdated.js`) → muestran la misma hora sin importar desde dónde se actualice.

La página de detalle es **read-only** respecto a estados y fechas (se eliminó el formulario de edición de estados — refactor jun 2026). La única mutación es el botón **"Mark as paid"** (Card "Referrer payment"), que marca manualmente el pago de €500 al referrer vía `MARK_REFERRER_PAID` (con `ConfirmDialog`). El pago dejó de detectarse por factura BC (finance emite una nota de abono que no llega a HubSpot), así que ahora el equipo lo marca a mano. Incluye navegación entre referrals del mismo referrer.

**Guard del botón "Mark as paid":** habilitado sólo si `deal.dealstage === "257909958"` (pre-settlement) **y** `deal.real_settlement_date` tiene valor **y** `referrer_payment_status !== "paid"`. Si no aplica → deshabilitado con el motivo visible. El back **revalida** (responde 422 si no aplica) y es **idempotente** (200 `{ info }` si ya estaba pagado). Al marcar, el back setea `referrer_payment_status=paid` + `referrer_payment_date=hoy` + `referrer_amount=500` + `referral_status=paid` y suma +500 a `total_earned` del referrer.

> **Edición fiscal (IBAN/NIF/Address) eliminada (jun 2026):** el bloque "Referrer fiscal data" y el endpoint `FISCAL_UPDATE` (wf-d5) quedaron deprecados y desactivados en n8n (POST → sin respuesta). d2 dejó de devolver `referrer.iban/nif/address`. El front eliminó la Card fiscal, la función `updateReferrerFiscalAndPay()` y la constante `FISCAL_UPDATE`.

## Endpoints n8n

Definidos como constantes en `src/api/hubspot.js`. El path real lleva el sufijo `VITE_N8N_ENV_SUFFIX` (`-prod` en Production, vacío en dev/local):

| Constante             | Path base (sin sufijo)                   | Uso                                          |
|-----------------------|------------------------------------------|----------------------------------------------|
| `LIST`                | `/webhook/dashboard-referrals-list`      | Lista de referrals (paginada server-side)    |
| `DETAIL`              | `/webhook/dashboard-referral-detail`     | Detalle de un referral por ID                |
| `KPIS`                | `/webhook/dashboard-referrals-kpis`      | Métricas agregadas                           |
| `MARK_REFERRER_PAID`  | `/webhook/dashboard-mark-referrer-paid`  | Marca manualmente el pago al referrer (€500) |

**`MARK_REFERRER_PAID`** — POST `{ referralId }`. Respuestas: `200 { success: true, action: "referrer_marked_paid" }` (marcado OK), `200 { info: "...ya estaba marcado..." }` (idempotente), `422 { error: "..." }` (deal no en pre-settlement o sin `real_settlement_date` — el front muestra el motivo), `401` (no autorizado). El back revalida siempre el guard.

Todos los endpoints reciben POST con `Authorization: Bearer <ID token de Google>` en header. n8n valida el JWT server-side (sub-workflow `auth-guard-google-jwt`) antes de procesar. (Antes usaban `x-api-key`; migrado en jun 2026.)

### Contrato de la lista (d1) — paginación server-side

El endpoint d1 pagina server-side: acepta `page` (default 1) y `pageSize` (default 20, **cap 200**) y responde `{ referrals, total, page, pageSize, totalPages }` (mismo shape en página vacía). Filtra server-side **sólo** `unit`, `referral_status` (status) y `search` (full-text `query` de HubSpot). **No** filtra server-side `referrer_payment_status`, `referido_discount_status`, `dateFrom`/`dateTo`, ni hace group-by-referrer.

> **d1 devuelve `deal.real_settlement_date` (jun 2026):** se agregó esa prop al objeto `deal` de cada referral (dev `qv07eEGAiAmdKTdj` + prod `d4B7uKmKuCTguLCy`, en los nodos "Prepare Detail Requests" y "Build Response"), espejo de d2. Lo usa el filtro client-side "Settlement period". Cambio aditivo; los typeIds de asociación de prod (233/235) quedaron intactos.

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
  deal:     { dealname, pipeline, dealstage, real_settlement_date }
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
| `src/lib/referralFilters.js`           | Lógica pura testeada: `filterReferrals`, `filterByPeriod`, `referrerPaymentStatus`, `sortReferrals`, `groupByReferrer` (+ `.test.js`) |
| `src/lib/lastUpdated.js`               | `latestDataUpdate()` / `formatLastUpdated()` — fuente única del "last updated" (dashboard, detalle y reminder) |
| `src/pages/Dashboard.jsx`              | Lista principal con filtros (incl. Settlement period), KPIs, orden por columna, paginación, botón Export |
| `src/pages/ReferralDetail.jsx`         | Vista read-only del referral + botón "Mark as paid" (pago manual al referrer) + navegación entre siblings |
| `src/components/ReferralTable.jsx`     | Tabla de referrals (presentacional)                           |
| `src/components/RefreshReminder.jsx`   | Popup global cada 30s recordando apretar Refresh (+ last updated) |
| `src/components/GlobalRefreshReminder.jsx` | Monta el reminder a nivel app sólo para usuarios autenticados |
| `src/components/ExportModal.jsx`       | Modal de exportación Excel con selección de columnas          |
| `src/components/StatusBadge.jsx`       | Badge de estado (created/paid/pending/applied/ready_to_transfer) |
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
- **Detalle read-only:** se eliminó el formulario de edición de estados/fechas; el detalle solo muestra datos. La única mutación desde el detalle es **"Mark as paid"** (`MARK_REFERRER_PAID`), que marca el pago manual al referrer. El guard del botón usa `deal.dealstage`/`deal.real_settlement_date` (nuevos campos que ahora trae d2) y el back revalida (422) — ver "Estado actual".
- **Manejo de errores (`request()` en `hubspot.js`):** ante un response no-ok, parsea el body JSON y prefiere `error`/`message` como mensaje del `ApiError` (así el motivo del 422 de mark-paid llega legible al toast); cae al texto crudo si no es JSON.
- **"Ready to transfer" es display-only:** `referrerPaymentStatus()` deriva el badge (applied + pago pending → `ready_to_transfer`); el filtro "Referrer payment" y los datos crudos siguen usando `referrer_payment_status` (`pending`). Así no se rompe el filtrado.
- **Period filter sobre `deal.real_settlement_date`:** client-side (`filterByPeriod`, semana lun–dom / mes calendario, `now` inyectable para tests). Referrals sin deal o sin settlement date quedan fuera de cualquier período acotado. Depende de que d1 traiga el campo (ya agregado).
- **"last updated" unificado:** `latestDataUpdate(queryClient)` devuelve el `dataUpdatedAt` más reciente entre `referrals`/`referral`/`kpis` del cache; lo leen el header del dashboard, el del detalle y el reminder → misma hora sin importar desde qué pantalla se refresque. Se eligió esto (vs. el `dataUpdatedAt` de cada query) porque cada pantalla tenía su propia hora.
- **RefreshReminder global:** montado en `App` (no por página) para que el timer sea continuo entre rutas; guardado por `isAuthenticated` (no aparece en login). 30s de intervalo, 6s visible.
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
