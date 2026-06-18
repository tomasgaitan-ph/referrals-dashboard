import { useState } from 'react'
import * as XLSX from 'xlsx'

const EXPORT_COLUMNS = [
  { key: 'referral_id',              label: 'Referral ID',           get: r => r.referral_id ?? '' },
  { key: 'unit',                     label: 'Program',               get: r => r.unit ?? '' },
  { key: 'referral_status',          label: 'Referral Status',       get: r => r.referral_status ?? '' },
  { key: 'referrer_name',            label: 'Referrer Name',         get: r => [r.referrer?.firstname, r.referrer?.lastname].filter(Boolean).join(' ') || '' },
  { key: 'referrer_code',            label: 'Referrer Code',         get: r => r.referrer?.referrer_code ?? '' },
  { key: 'total_referrals',          label: 'Total Referrals',       get: r => r.referrer?.total_referrals ?? '' },
  { key: 'referred_name',            label: 'Referral Name',         get: r => [r.referido?.firstname, r.referido?.lastname].filter(Boolean).join(' ') || '' },
  { key: 'deal_name',                label: 'Deal',                  get: r => r.deal?.dealname ?? '' },
  { key: 'referrer_payment_status',  label: 'Referrer Payment',      get: r => r.referrer_payment_status ?? '' },
  { key: 'referrer_payment_date',    label: 'Referrer Payment Date', get: r => r.referrer_payment_date ?? '' },
  { key: 'referrer_amount',          label: 'Referrer Amount (€)',   get: r => r.referrer_amount != null ? Number(r.referrer_amount) : '' },
  { key: 'referido_discount_status', label: 'Discount Status',       get: r => r.referido_discount_status ?? '' },
  { key: 'referido_discount_date',   label: 'Discount Date',         get: r => r.referido_discount_date ?? '' },
  { key: 'referido_amount',          label: 'Discount Amount (€)',   get: r => r.referido_amount != null ? Number(r.referido_amount) : '' },
  { key: 'created_date',             label: 'Created Date',          get: r => r.created_date ?? '' },
]

const ALL_KEYS = EXPORT_COLUMNS.map(c => c.key)

export default function ExportModal({ referrals, onClose }) {
  const [selected, setSelected] = useState(new Set(ALL_KEYS))

  const allChecked  = selected.size === EXPORT_COLUMNS.length
  const someChecked = selected.size > 0 && !allChecked

  function toggle(key) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleAll() {
    setSelected(allChecked ? new Set() : new Set(ALL_KEYS))
  }

  function handleExport() {
    const cols = EXPORT_COLUMNS.filter(c => selected.has(c.key))
    const headers = cols.map(c => c.label)
    const rows = referrals.map(r => cols.map(c => c.get(r)))

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Referrals')

    const date = new Date().toISOString().slice(0, 10)
    XLSX.writeFile(wb, `referrals_${date}.xlsx`)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-semibold text-slate-800">Export to Excel</h2>
            <p className="text-xs text-slate-400 mt-0.5">{referrals.length} referral{referrals.length !== 1 ? 's' : ''} · select columns</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Select all */}
        <div className="px-5 py-3 border-b border-slate-100">
          <label className="flex items-center gap-2.5 cursor-pointer group">
            <input
              type="checkbox"
              checked={allChecked}
              ref={el => { if (el) el.indeterminate = someChecked }}
              onChange={toggleAll}
              className="h-4 w-4 rounded border-slate-300 text-secondary accent-secondary cursor-pointer"
            />
            <span className="text-xs font-medium text-slate-600 group-hover:text-slate-800 transition-colors">
              Select all
            </span>
          </label>
        </div>

        {/* Column list */}
        <div className="overflow-y-auto flex-1 px-5 py-3 space-y-2.5">
          {EXPORT_COLUMNS.map(col => (
            <label key={col.key} className="flex items-center gap-2.5 cursor-pointer group">
              <input
                type="checkbox"
                checked={selected.has(col.key)}
                onChange={() => toggle(col.key)}
                className="h-4 w-4 rounded border-slate-300 text-secondary accent-secondary cursor-pointer"
              />
              <span className="text-sm text-slate-600 group-hover:text-slate-800 transition-colors">
                {col.label}
              </span>
            </label>
          ))}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            onClick={onClose}
            className="text-sm text-slate-500 hover:text-slate-700 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={selected.size === 0}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-secondary transition-colors disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
            </svg>
            Download .xlsx
          </button>
        </div>
      </div>
    </div>
  )
}
