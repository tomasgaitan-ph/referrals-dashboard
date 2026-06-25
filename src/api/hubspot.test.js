import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const BASE_URL = 'https://n8n.test.prophero.com'

// El módulo lee import.meta.env (BASE_URL + sufijo) en tiempo de import, así que
// para probar distintos sufijos hay que stubbear el env y re-importar el módulo.
async function loadApi({ suffix = '' } = {}) {
  vi.resetModules()
  vi.stubEnv('VITE_N8N_BASE_URL', BASE_URL)
  vi.stubEnv('VITE_N8N_ENV_SUFFIX', suffix)
  return import('./hubspot')
}

// Mock de fetch que devuelve una respuesta 200 con el body JSON dado.
function mockFetchOk(json = { referrals: [], total: 0, page: 1, pageSize: 200, totalPages: 0 }) {
  const fetchMock = vi.fn().mockResolvedValue({
    status: 200,
    ok: true,
    statusText: 'OK',
    text: async () => JSON.stringify(json),
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

// Devuelve { url, options, body } de la primera llamada a fetch.
function firstCall(fetchMock) {
  const [url, options] = fetchMock.mock.calls[0]
  return { url, options, body: JSON.parse(options.body) }
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
})

describe('fetchReferralsList — paginación bridge (Path A)', () => {
  let fetchMock

  beforeEach(() => {
    fetchMock = mockFetchOk()
  })

  it('manda page:1 y pageSize:200 en el body (trae todo en una página)', async () => {
    const { fetchReferralsList } = await loadApi()
    await fetchReferralsList({ unit: 'SP' })

    const { body, options } = firstCall(fetchMock)
    expect(options.method).toBe('POST')
    expect(options.headers['Content-Type']).toBe('application/json')
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(200)
    expect(body.unit).toBe('SP')
  })

  it('propaga status/search y usa null por defecto', async () => {
    const { fetchReferralsList } = await loadApi()
    await fetchReferralsList({ unit: null, status: 'created', search: 'REF-1' })

    const { body } = firstCall(fetchMock)
    expect(body).toMatchObject({ unit: null, status: 'created', search: 'REF-1', page: 1, pageSize: 200 })
  })

  it('sin argumentos manda unit/status/search en null pero mantiene la paginación', async () => {
    const { fetchReferralsList } = await loadApi()
    await fetchReferralsList()

    const { body } = firstCall(fetchMock)
    expect(body).toEqual({ unit: null, status: null, search: null, page: 1, pageSize: 200 })
  })
})

describe('sufijo de entorno (VITE_N8N_ENV_SUFFIX)', () => {
  it('sufijo vacío → paths dev (sandbox)', async () => {
    const fetchMock = mockFetchOk()
    const { fetchReferralsList } = await loadApi({ suffix: '' })
    await fetchReferralsList({ unit: 'VH' })

    expect(firstCall(fetchMock).url).toBe(`${BASE_URL}/webhook/dashboard-referrals-list`)
  })

  it('sufijo "-prod" → paths prod en todos los endpoints', async () => {
    const fetchMock = mockFetchOk({})
    const api = await loadApi({ suffix: '-prod' })

    await api.fetchReferralsList({ unit: 'VH' })
    expect(firstCall(fetchMock).url).toBe(`${BASE_URL}/webhook/dashboard-referrals-list-prod`)

    fetchMock.mockClear()
    await api.fetchReferralDetail('abc123')
    expect(firstCall(fetchMock).url).toBe(`${BASE_URL}/webhook/dashboard-referral-detail-prod`)

    fetchMock.mockClear()
    await api.fetchKPIs({ unit: 'VH' })
    expect(firstCall(fetchMock).url).toBe(`${BASE_URL}/webhook/dashboard-referrals-kpis-prod`)

    fetchMock.mockClear()
    await api.markReferrerPaid('abc123')
    expect(firstCall(fetchMock).url).toBe(`${BASE_URL}/webhook/dashboard-mark-referrer-paid-prod`)
  })
})

describe('markReferrerPaid', () => {
  it('manda { referralId } al endpoint de mark-paid', async () => {
    const fetchMock = mockFetchOk({ success: true, action: 'referrer_marked_paid' })
    const { markReferrerPaid } = await loadApi()

    const result = await markReferrerPaid('hs-42')

    const { url, body, options } = firstCall(fetchMock)
    expect(url).toBe(`${BASE_URL}/webhook/dashboard-mark-referrer-paid`)
    expect(options.method).toBe('POST')
    expect(body).toEqual({ referralId: 'hs-42' })
    expect(result).toEqual({ success: true, action: 'referrer_marked_paid' })
  })

  it('un 422 surfacea el campo error del body como mensaje del ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 422,
      ok: false,
      statusText: 'Unprocessable Entity',
      text: async () => JSON.stringify({ error: 'Deal no está en pre-settlement o no tiene real_settlement_date' }),
    }))
    const { markReferrerPaid } = await loadApi()

    await expect(markReferrerPaid('hs-42')).rejects.toMatchObject({
      status: 422,
      message: 'Deal no está en pre-settlement o no tiene real_settlement_date',
    })
  })
})

describe('auth y manejo de errores', () => {
  it('agrega Authorization: Bearer cuando hay token, y no lo manda si no hay', async () => {
    const fetchMock = mockFetchOk()
    const { fetchReferralsList, setAuthToken } = await loadApi()

    await fetchReferralsList({ unit: 'SP' })
    expect(firstCall(fetchMock).options.headers.Authorization).toBeUndefined()

    fetchMock.mockClear()
    setAuthToken('id-token-123')
    await fetchReferralsList({ unit: 'SP' })
    expect(firstCall(fetchMock).options.headers.Authorization).toBe('Bearer id-token-123')
  })

  it('un 401 dispara el handler de no-autorizado y lanza ApiError', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 401, ok: false, statusText: 'Unauthorized', text: async () => '',
    }))
    const { fetchReferralsList, setUnauthorizedHandler } = await loadApi()

    const onUnauthorized = vi.fn()
    setUnauthorizedHandler(onUnauthorized)

    await expect(fetchReferralsList({ unit: 'SP' })).rejects.toMatchObject({ status: 401 })
    expect(onUnauthorized).toHaveBeenCalledOnce()
  })

  it('una respuesta vacía (página vacía) se parsea como {} sin romper', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200, ok: true, statusText: 'OK', text: async () => '',
    }))
    const { fetchReferralsList } = await loadApi()

    await expect(fetchReferralsList({ unit: 'SP' })).resolves.toEqual({})
  })

  it('un body no-JSON lanza ApiError de respuesta inválida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200, ok: true, statusText: 'OK', text: async () => '<html>error</html>',
    }))
    const { fetchReferralsList } = await loadApi()

    await expect(fetchReferralsList({ unit: 'SP' })).rejects.toThrow(/Respuesta inválida/)
  })
})
