import StatusBadge from './StatusBadge'

const COLUMNS = [
  { key: 'referral_id', label: 'ID',               width: 'w-36' },
  { key: 'unit',        label: 'Program',           width: 'w-20' },
  { key: 'referrer',        label: 'Referrer',          width: 'w-40' },
  { key: 'referrer_code',   label: 'Code',              width: 'w-28' },
  { key: 'total_referrals', label: '# Refs',            width: 'w-20' },
  { key: 'referido',        label: 'Referred',          width: 'w-40' },
  { key: 'deal',        label: 'Deal',              width: 'w-44' },
  { key: 'status',      label: 'Status',            width: 'w-28' },
  { key: 'pago',        label: 'Referrer Payment',  width: 'w-32' },
  { key: 'descuento',   label: 'Discount',          width: 'w-32' },
  { key: 'fecha',       label: 'Date',              width: 'w-28' },
  { key: 'action',      label: '',                  width: 'w-10' },
]

const UNIT_CLASSES = {
  SP: 'bg-blue-50 text-blue-700 border-blue-200',
  VH: 'bg-violet-50 text-violet-700 border-violet-200',
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function fullName(contact) {
  if (!contact) return '—'
  return [contact.firstname, contact.lastname].filter(Boolean).join(' ') || '—'
}

function SortIcon({ state }) {
  // state: 'asc' | 'desc' | null
  if (!state) {
    return (
      <svg className="h-3 w-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9 12 5.25 15.75 9M8.25 15 12 18.75 15.75 15" />
      </svg>
    )
  }
  return (
    <svg className="h-3 w-3 text-secondary" fill="none" viewBox="0 0 24 24" strokeWidth="2.5" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d={state === 'asc' ? 'M4.5 15.75l7.5-7.5 7.5 7.5' : 'M19.5 8.25l-7.5 7.5-7.5-7.5'} />
    </svg>
  )
}

function SkeletonRow() {
  return (
    <tr className="border-b border-slate-100">
      {COLUMNS.map(col => (
        <td key={col.key} className="px-4 py-3.5">
          <div className="h-3.5 rounded bg-slate-100 animate-pulse" style={{ width: col.key === 'action' ? '16px' : '80%' }} />
        </td>
      ))}
    </tr>
  )
}

export default function ReferralTable({ referrals = [], loading = false, onRowClick, sort, onSort }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-[0_2px_8px_-2px_rgba(26,60,94,0.06)]">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {COLUMNS.map(col => {
              const sortable = onSort && col.key !== 'action'
              const state = sort?.key === col.key ? sort.dir : null
              return (
                <th
                  key={col.key}
                  className={`${col.width} px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500`}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className="group inline-flex items-center gap-1 uppercase tracking-wider hover:text-slate-700 transition-colors"
                    >
                      {col.label}
                      <SortIcon state={state} />
                    </button>
                  ) : (
                    col.label
                  )}
                </th>
              )
            })}
          </tr>
        </thead>

        <tbody>
          {loading && Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}

          {!loading && referrals.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="py-16 text-center">
                <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                </svg>
                <p className="mt-3 text-sm font-medium text-slate-400">No referrals</p>
                <p className="mt-1 text-xs text-slate-300">No results for the applied filters</p>
              </td>
            </tr>
          )}

          {!loading && referrals.map(r => (
            <tr
              key={r.referralHsId}
              onClick={() => onRowClick(r.referralHsId)}
              className="border-b border-slate-100 cursor-pointer transition-colors hover:bg-slate-50 active:bg-slate-100 last:border-0"
            >
              <td className="px-4 py-3.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                {r.referral_id ?? '—'}
              </td>
              <td className="px-4 py-3.5">
                {r.unit ? (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${UNIT_CLASSES[r.unit] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {r.unit}
                  </span>
                ) : '—'}
              </td>
              <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">{fullName(r.referrer)}</td>
              <td className="px-4 py-3.5 font-mono text-xs text-slate-600 whitespace-nowrap">
                {r.referrer?.referrer_code ?? '—'}
              </td>
              <td className="px-4 py-3.5 text-center text-sm font-semibold tabular-nums text-slate-700">
                {r.referrer?.total_referrals ?? '—'}
              </td>
              <td className="px-4 py-3.5 text-slate-700 whitespace-nowrap">{fullName(r.referido)}</td>
              <td className="px-4 py-3.5 text-slate-600 whitespace-nowrap max-w-[11rem] truncate">
                {r.deal?.dealname ?? '—'}
              </td>
              <td className="px-4 py-3.5">
                <StatusBadge status={r.referral_status} />
              </td>
              <td className="px-4 py-3.5">
                <StatusBadge status={r.referrer_payment_status} />
              </td>
              <td className="px-4 py-3.5">
                <StatusBadge status={r.referido_discount_status} />
              </td>
              <td className="px-4 py-3.5 text-xs text-slate-500 whitespace-nowrap font-mono tabular-nums">
                {formatDate(r.created_date)}
              </td>
              <td className="px-4 py-3.5 text-slate-300">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
