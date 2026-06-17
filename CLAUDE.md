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
- **Backend/API:** n8n webhooks (no hay backend propio). Variables de entorno: `VITE_N8N_BASE_URL` + `VITE_GOOGLE_CLIENT_ID` (ya no se usa `VITE_API_KEY` — el front manda el JWT de Google y n8n lo valida)
- **Deploy:** Vercel

## Colores del sistema de diseño

Definidos en `tailwind.config.js`:
- `primary`: `#101542` (azul oscuro — header, botones principales)
- `secondary`: `#2E6DA4` (azul medio — links, foco, botón fiscal)
- `background`: `#F0F4F8` (gris claro — fondo de página)

## Estado actual

App funcional y deployada. El dashboard muestra lista de referrals con filtros, KPIs, paginación (PAGE_SIZE = 20) y exportación a Excel. La página de detalle permite editar estados, fechas, datos fiscales y muestra navegación entre referrals del mismo referrer.

## Endpoints n8n

Definidos como constantes en `src/api/hubspot.js`:

| Constante        | Path                                        | Uso                                        |
|------------------|---------------------------------------------|--------------------------------------------|
| `LIST`           | `/webhook/dashboard-referrals-list`         | Trae todos los referrals (filtro por unit) |
| `DETAIL`         | `/webhook/dashboard-referral-detail`        | Detalle de un referral por ID              |
| `UPDATE`         | `/webhook/dashboard-referral-update`        | Actualiza estado/fechas de un referral     |
| `KPIS`           | `/webhook/dashboard-referrals-kpis`         | Métricas agregadas                         |
| `FISCAL_UPDATE`  | `/webhook/dashboard-update-referrer-fiscal` | Guarda datos fiscales y relanza pago       |

Todos los endpoints reciben POST con `Authorization: Bearer <ID token de Google>` en header. n8n valida el JWT server-side (sub-workflow `auth-guard-google-jwt`) antes de procesar. (Antes usaban `x-api-key`; migrado en jun 2026.)

## Estructura de datos del referral (objeto en lista)

```js
{
  referralHsId,              // ID interno HubSpot (usado como key de tabla y para routing)
  referral_id,               // ID legible (ej: "REF-0001")
  unique_id,                 // ID único alternativo (viene del detalle, no de la lista)
  unit,                      // "SP" | "VH"
  referral_status,           // "created" | "paid"
  referrer_payment_status,   // "pending" | "paid"
  referrer_payment_date,
  referido_discount_status,  // "pending" | "applied"
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
| `src/pages/Dashboard.jsx`              | Lista principal con filtros, KPIs, paginación, botón Export   |
| `src/pages/ReferralDetail.jsx`         | Vista y edición de un referral + navegación entre siblings    |
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
- **Filtrado 100% client-side:** la API lista devuelve los referrals del unit seleccionado (⚠️ cap server-side de `limit: 200`); el filtrado por texto, estado y fecha se hace en el frontend sobre esos datos.
- **Paginación client-side:** PAGE_SIZE = 20, calculado sobre `displayRows` (agrupado por referrer).
- **Dashboard agrupa por referrer:** `displayRows` muestra una fila por referrer (el referral más reciente). La exportación Excel usa `filtered` (todos los referrals individuales).
- **Auth de usuario:** login con Google restringido a `@prophero.com`; el front manda el ID token (`Authorization: Bearer`) y n8n valida el JWT server-side. (Antes: API key en header — migrado jun 2026.)
- **`referralHsId` como identificador de ruta:** `/referral/:id` usa el ID interno de HubSpot.
- **Siblings navigation:** `ReferralDetail` llama a `useReferrals()` directamente para obtener los referrals del mismo referrer y mostrar flechas de navegación en los extremos de la pantalla (fixed left/right).

## Próximos pasos

- **Paginación server-side (cuando el volumen supere ~200):** la API `dashboard-referrals-list` está capada en `limit: 200` server-side y el filtrado es client-side, así que opera solo sobre esos 200. Cuando los referrals pasen de 200, el front no ve el resto → habrá que mover paginación/filtrado al backend (n8n). Hoy no es problema; tenerlo en el radar.
