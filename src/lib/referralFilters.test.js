import { describe, it, expect } from 'vitest'
import { filterReferrals, filterByPeriod, referrerPaymentStatus, groupByReferrer, sortReferrals } from './referralFilters'

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

describe('sortReferrals', () => {
  it('ordena strings asc/desc (case-insensitive)', () => {
    const list = [
      ref({ referralHsId: '1', referrer: { firstname: 'beto', lastname: '' } }),
      ref({ referralHsId: '2', referrer: { firstname: 'Ana', lastname: '' } }),
      ref({ referralHsId: '3', referrer: { firstname: 'Carlos', lastname: '' } }),
    ]
    expect(sortReferrals(list, 'referrer', 'asc').map(r => r.referralHsId)).toEqual(['2', '1', '3'])
    expect(sortReferrals(list, 'referrer', 'desc').map(r => r.referralHsId)).toEqual(['3', '1', '2'])
  })

  it('ordena numéricamente total_referrals (no como string)', () => {
    const list = [
      ref({ referralHsId: '1', referrer: { total_referrals: 9 } }),
      ref({ referralHsId: '2', referrer: { total_referrals: 10 } }),
      ref({ referralHsId: '3', referrer: { total_referrals: 2 } }),
    ]
    expect(sortReferrals(list, 'total_referrals', 'asc').map(r => r.referralHsId)).toEqual(['3', '1', '2'])
  })

  it('ordena por fecha', () => {
    const list = [
      ref({ referralHsId: '1', created_date: '2026-06-10' }),
      ref({ referralHsId: '2', created_date: '2026-06-01' }),
      ref({ referralHsId: '3', created_date: '2026-06-20' }),
    ]
    expect(sortReferrals(list, 'fecha', 'desc').map(r => r.referralHsId)).toEqual(['3', '1', '2'])
  })

  it('manda los vacíos al final (en ambas direcciones)', () => {
    const list = [
      ref({ referralHsId: '1', deal: { dealname: 'Beta' } }),
      ref({ referralHsId: '2', deal: { dealname: '' } }),
      ref({ referralHsId: '3', deal: { dealname: 'Alfa' } }),
    ]
    expect(sortReferrals(list, 'deal', 'asc').map(r => r.referralHsId)).toEqual(['3', '1', '2'])
    expect(sortReferrals(list, 'deal', 'desc').map(r => r.referralHsId)).toEqual(['1', '3', '2'])
  })

  it('key desconocida devuelve la lista sin cambios', () => {
    const list = [ref({ referralHsId: '1' }), ref({ referralHsId: '2' })]
    expect(sortReferrals(list, 'inexistente', 'asc').map(r => r.referralHsId)).toEqual(['1', '2'])
  })

  it('no muta la lista original', () => {
    const list = [ref({ referralHsId: '2', created_date: '2026-06-01' }), ref({ referralHsId: '1', created_date: '2026-06-02' })]
    const before = list.map(r => r.referralHsId)
    sortReferrals(list, 'fecha', 'asc')
    expect(list.map(r => r.referralHsId)).toEqual(before)
  })
})

describe('referrerPaymentStatus', () => {
  it("pago pending + descuento applied → 'ready_to_transfer'", () => {
    expect(referrerPaymentStatus(ref({ referrer_payment_status: 'pending', referido_discount_status: 'applied' }))).toBe('ready_to_transfer')
  })
  it("pago pending pero descuento NO applied → 'pending'", () => {
    expect(referrerPaymentStatus(ref({ referrer_payment_status: 'pending', referido_discount_status: 'pending' }))).toBe('pending')
    expect(referrerPaymentStatus(ref({ referrer_payment_status: 'pending', referido_discount_status: 'not_applicable' }))).toBe('pending')
  })
  it("pago paid → 'paid' (aunque el descuento esté applied)", () => {
    expect(referrerPaymentStatus(ref({ referrer_payment_status: 'paid', referido_discount_status: 'applied' }))).toBe('paid')
  })
  it('referral nulo/sin status no rompe', () => {
    expect(referrerPaymentStatus(null)).toBeUndefined()
    expect(referrerPaymentStatus({})).toBeUndefined()
  })
})

describe('filterByPeriod (sobre deal.real_settlement_date)', () => {
  // now fijo: miércoles 2026-06-17 (semana ISO lun 15 – dom 21 jun)
  const now = new Date(2026, 5, 17, 12, 0, 0)
  // El settlement date viene anidado en deal (forma real de d1).
  const withSettlement = (id, date) => ref({ referralHsId: id, deal: { dealname: 'Deal', real_settlement_date: date } })

  it("'all'/vacío no filtra (devuelve todo, incluso sin settlement date)", () => {
    const list = [withSettlement('a', '2026-01-01'), withSettlement('b', null)]
    expect(filterByPeriod(list, '', now)).toHaveLength(2)
    expect(filterByPeriod(list, 'all', now)).toHaveLength(2)
  })

  it('lista nula/indefinida devuelve []', () => {
    expect(filterByPeriod(null, 'month', now)).toEqual([])
    expect(filterByPeriod(undefined, 'week', now)).toEqual([])
  })

  it("excluye referrals sin deal o sin settlement date en períodos acotados", () => {
    const list = [
      withSettlement('sin-fecha', null),
      ref({ referralHsId: 'sin-deal', deal: null }),
    ]
    expect(filterByPeriod(list, 'month', now)).toEqual([])
  })

  it("'week' incluye lunes y domingo de la semana actual y excluye fuera", () => {
    const list = [
      withSettlement('lun', '2026-06-15T00:00:00'),
      withSettlement('dom', '2026-06-21T23:00:00'),
      withSettlement('prev', '2026-06-14T23:59:59'),
      withSettlement('next', '2026-06-22T00:00:00'),
    ]
    expect(filterByPeriod(list, 'week', now).map(r => r.referralHsId)).toEqual(['lun', 'dom'])
  })

  it("'month' incluye sólo junio 2026", () => {
    const list = [
      withSettlement('jun1', '2026-06-01T00:00:00'),
      withSettlement('jun30', '2026-06-30T23:00:00'),
      withSettlement('may', '2026-05-31T23:59:59'),
      withSettlement('jul', '2026-07-01T00:00:00'),
    ]
    expect(filterByPeriod(list, 'month', now).map(r => r.referralHsId)).toEqual(['jun1', 'jun30'])
  })

  it("acepta el formato ISO date corto de HubSpot (YYYY-MM-DD)", () => {
    const list = [withSettlement('hoy', '2026-06-17')]
    expect(filterByPeriod(list, 'month', now).map(r => r.referralHsId)).toEqual(['hoy'])
    expect(filterByPeriod(list, 'week', now).map(r => r.referralHsId)).toEqual(['hoy'])
  })

  it("'last_month' incluye sólo mayo 2026", () => {
    const list = [
      withSettlement('may1', '2026-05-01T00:00:00'),
      withSettlement('may31', '2026-05-31T23:00:00'),
      withSettlement('jun', '2026-06-01T00:00:00'),
    ]
    expect(filterByPeriod(list, 'last_month', now).map(r => r.referralHsId)).toEqual(['may1', 'may31'])
  })

  it("'last_month' cruza el año (enero → diciembre anterior)", () => {
    const jan = new Date(2026, 0, 10, 12, 0, 0)
    const list = [
      withSettlement('dec', '2025-12-15T00:00:00'),
      withSettlement('jan', '2026-01-05T00:00:00'),
    ]
    expect(filterByPeriod(list, 'last_month', jan).map(r => r.referralHsId)).toEqual(['dec'])
  })
})
