import { describe, it, expect } from 'vitest'
import { filterReferrals, groupByReferrer } from './referralFilters'

// Referral de prueba con defaults razonables, sobreescribibles por test.
function ref(overrides = {}) {
  return {
    referralHsId: '1',
    referral_id: 'REF-0001',
    referral_status: 'created',
    referrer_payment_status: 'pending',
    referido_discount_status: 'pending',
    created_date: '2026-06-10',
    referrer: { firstname: 'Ana', lastname: 'García', referrer_code: 'PH-AAA' },
    referido: { firstname: 'Beto', lastname: 'López' },
    deal: { dealname: 'Deal Uno' },
    ...overrides,
  }
}

describe('filterReferrals', () => {
  it('sin filtros devuelve la lista completa', () => {
    const list = [ref(), ref({ referralHsId: '2' })]
    expect(filterReferrals(list, {})).toHaveLength(2)
  })

  it('lista nula/indefinida devuelve []', () => {
    expect(filterReferrals(null, {})).toEqual([])
    expect(filterReferrals(undefined, {})).toEqual([])
  })

  describe('búsqueda por texto (case-insensitive)', () => {
    const list = [
      ref({ referralHsId: '1', referral_id: 'REF-0001', referrer: { firstname: 'Ana', lastname: 'García', referrer_code: 'PH-AAA' } }),
      ref({ referralHsId: '2', referral_id: 'REF-0002', referrer: { firstname: 'Carlos', lastname: 'Ruiz' }, referido: { firstname: 'Diana', lastname: 'Paz' }, deal: { dealname: 'Proyecto X' } }),
    ]
    it('matchea por referral_id', () => {
      expect(filterReferrals(list, { search: 'ref-0002' }).map(r => r.referralHsId)).toEqual(['2'])
    })
    it('matchea por nombre del referrer', () => {
      expect(filterReferrals(list, { search: 'carlos' }).map(r => r.referralHsId)).toEqual(['2'])
    })
    it('matchea por nombre del referido', () => {
      expect(filterReferrals(list, { search: 'diana' }).map(r => r.referralHsId)).toEqual(['2'])
    })
    it('matchea por nombre del deal', () => {
      expect(filterReferrals(list, { search: 'proyecto' }).map(r => r.referralHsId)).toEqual(['2'])
    })
    it('sin coincidencias devuelve []', () => {
      expect(filterReferrals(list, { search: 'zzz-inexistente' })).toEqual([])
    })
    it('no rompe con campos faltantes', () => {
      const sparse = [{ referralHsId: '9' }]
      expect(filterReferrals(sparse, { search: 'algo' })).toEqual([])
    })
  })

  describe('filtros de estado', () => {
    const list = [
      ref({ referralHsId: '1', referral_status: 'created', referrer_payment_status: 'pending', referido_discount_status: 'pending' }),
      ref({ referralHsId: '2', referral_status: 'paid',    referrer_payment_status: 'paid',    referido_discount_status: 'applied' }),
    ]
    it('statusFilter', () => {
      expect(filterReferrals(list, { statusFilter: 'paid' }).map(r => r.referralHsId)).toEqual(['2'])
    })
    it('paymentFilter', () => {
      expect(filterReferrals(list, { paymentFilter: 'pending' }).map(r => r.referralHsId)).toEqual(['1'])
    })
    it('discountFilter', () => {
      expect(filterReferrals(list, { discountFilter: 'applied' }).map(r => r.referralHsId)).toEqual(['2'])
    })
    it('combina filtros (AND)', () => {
      expect(filterReferrals(list, { statusFilter: 'paid', paymentFilter: 'pending' })).toEqual([])
    })
  })

  describe('rango de fechas (inclusivo)', () => {
    const list = [
      ref({ referralHsId: '1', created_date: '2026-06-01' }),
      ref({ referralHsId: '2', created_date: '2026-06-15' }),
      ref({ referralHsId: '3', created_date: '2026-06-30' }),
    ]
    it('dateFrom incluye el límite', () => {
      expect(filterReferrals(list, { dateFrom: '2026-06-15' }).map(r => r.referralHsId)).toEqual(['2', '3'])
    })
    it('dateTo incluye todo el día del límite', () => {
      expect(filterReferrals(list, { dateTo: '2026-06-15' }).map(r => r.referralHsId)).toEqual(['1', '2'])
    })
    it('rango cerrado', () => {
      expect(filterReferrals(list, { dateFrom: '2026-06-10', dateTo: '2026-06-20' }).map(r => r.referralHsId)).toEqual(['2'])
    })
    it('descarta referrals sin created_date cuando hay filtro de fecha', () => {
      const withNull = [...list, ref({ referralHsId: '4', created_date: null })]
      expect(filterReferrals(withNull, { dateFrom: '2026-01-01' }).map(r => r.referralHsId)).toEqual(['1', '2', '3'])
    })
  })
})

describe('groupByReferrer', () => {
  it('lista vacía/nula devuelve []', () => {
    expect(groupByReferrer([])).toEqual([])
    expect(groupByReferrer(null)).toEqual([])
  })

  it('una fila por referrer_code, conservando el más reciente', () => {
    const list = [
      ref({ referralHsId: '1', referrer: { referrer_code: 'PH-AAA' }, created_date: '2026-06-01' }),
      ref({ referralHsId: '2', referrer: { referrer_code: 'PH-AAA' }, created_date: '2026-06-20' }),
      ref({ referralHsId: '3', referrer: { referrer_code: 'PH-BBB' }, created_date: '2026-06-05' }),
    ]
    const result = groupByReferrer(list)
    expect(result).toHaveLength(2)
    // PH-AAA debe quedar con el referral más reciente (id 2)
    expect(result.find(r => r.referrer.referrer_code === 'PH-AAA').referralHsId).toBe('2')
  })

  it('ordena por created_date descendente', () => {
    const list = [
      ref({ referralHsId: '1', referrer: { referrer_code: 'PH-AAA' }, created_date: '2026-06-01' }),
      ref({ referralHsId: '2', referrer: { referrer_code: 'PH-BBB' }, created_date: '2026-06-20' }),
      ref({ referralHsId: '3', referrer: { referrer_code: 'PH-CCC' }, created_date: '2026-06-10' }),
    ]
    expect(groupByReferrer(list).map(r => r.referralHsId)).toEqual(['2', '3', '1'])
  })

  it('usa referralHsId como fallback cuando no hay referrer_code', () => {
    const list = [
      ref({ referralHsId: '1', referrer: {}, created_date: '2026-06-01' }),
      ref({ referralHsId: '2', referrer: {}, created_date: '2026-06-02' }),
    ]
    // Sin referrer_code, cada uno es su propio grupo (key = referralHsId)
    expect(groupByReferrer(list)).toHaveLength(2)
  })
})
