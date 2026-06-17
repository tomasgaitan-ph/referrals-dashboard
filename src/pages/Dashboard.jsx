import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useReferrals } from '../hooks/useReferrals'
import { useKPIs } from '../hooks/useKPIs'
import KPICard from '../components/KPICard'
import SearchBar from '../components/SearchBar'
import ReferralTable from '../components/ReferralTable'
import ExportModal from '../components/ExportModal'
import Toast from '../components/Toast'
import { useAuth } from '../auth/AuthContext'

const UNITS = [
  { value: null, label: 'All' },
  { value: 'SP',  label: 'SP' },
  { value: 'VH',  label: 'VH' },
]

const REFERRAL_STATUS_OPTIONS = [
  { value: '', label: 'Referral status' },
  { value: 'created', label: 'Created' },
  { value: 'paid',    label: 'Paid'    },
]

const PAYMENT_STATUS_OPTIONS = [
  { value: '', label: 'Referrer payment' },
  { value: 'pending', label: 'Pending' },
  { value: 'paid',    label: 'Paid'    },
]

const DISCOUNT_STATUS_OPTIONS = [
  { value: '', label: 'Referred discount' },
  { value: 'pending', label: 'Pending' },
  { value: 'applied', label: 'Applied' },
]

function formatEur(n) {
  return `€${Number(n ?? 0).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const PAGE_SIZE = 20

function DateInput({ value, onChange, placeholder }) {
  const active = Boolean(value)
  return (
    <div className="relative">
      <svg
        className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors ${active ? 'text-secondary' : 'text-slate-400'}`}
        fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
      </svg>
      {!value && (
        <span className="pointer-events-none absolute inset-y-0 left-8 right-3 flex items-center text-sm text-slate-500 whitespace-nowrap">
          {placeholder}
        </span>
      )}
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`rounded-lg border py-2 pl-8 pr-3 text-sm outline-none transition-colors cursor-pointer ${
          !value ? '[color:transparent]' : ''
        } ${
          active
            ? 'border-secondary bg-secondary/5 text-secondary font-medium'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
        }`}
      />
    </div>
  )
}

function FilterSelect({ value, onChange, options }) {
  const active = Boolean(value)
  return (
    <div className="relative">
      <svg
        className={`pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 transition-colors ${active ? 'text-secondary' : 'text-slate-400'}`}
        fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 4.5h18M7 9.5h10M11 14.5h2" />
      </svg>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`rounded-lg border py-2 pl-8 pr-8 text-sm outline-none transition-colors cursor-pointer appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-no-repeat bg-[right_10px_center] ${
          active
            ? 'border-secondary bg-secondary/5 text-secondary font-medium'
            : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300'
        }`}
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const [unit,           setUnit]           = useState(null)
  const [search,         setSearch]         = useState('')
  const [statusFilter,   setStatusFilter]   = useState('')
  const [paymentFilter,  setPaymentFilter]  = useState('')
  const [discountFilter, setDiscountFilter] = useState('')
  const [dateFrom,       setDateFrom]       = useState('')
  const [dateTo,         setDateTo]         = useState('')
  const [page,           setPage]           = useState(1)
  const [toast,          setToast]          = useState(null)
  const [showExport,     setShowExport]     = useState(false)

  const {
    data: referralsData,
    isLoading: referralsLoading,
    isError: referralsError,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useReferrals({ unit })

  const {
    data: kpisData,
    isLoading: kpisLoading,
  } = useKPIs({ unit })

  const totalReferrals = referralsData?.referrals?.length ?? null

  const totalReferrers = useMemo(() => {
    const list = referralsData?.referrals ?? []
    if (!list.length) return null
    return new Set(list.map(r => r.referrer?.referrer_code ?? r.referralHsId)).size
  }, [referralsData])

  const filtered = useMemo(() => {
    let list = referralsData?.referrals ?? []

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(r =>
        r.referral_id?.toLowerCase().includes(q) ||
        `${r.referrer?.firstname ?? ''} ${r.referrer?.lastname ?? ''}`.toLowerCase().includes(q) ||
        `${r.referido?.firstname ?? ''} ${r.referido?.lastname ?? ''}`.toLowerCase().includes(q) ||
        r.deal?.dealname?.toLowerCase().includes(q)
      )
    }
    if (statusFilter)   list = list.filter(r => r.referral_status         === statusFilter)
    if (paymentFilter)  list = list.filter(r => r.referrer_payment_status  === paymentFilter)
    if (discountFilter) list = list.filter(r => r.referido_discount_status === discountFilter)
    if (dateFrom) {
      const from = new Date(dateFrom)
      list = list.filter(r => r.created_date && new Date(r.created_date) >= from)
    }
    if (dateTo) {
      const to = new Date(dateTo)
      to.setHours(23, 59, 59, 999)
      list = list.filter(r => r.created_date && new Date(r.created_date) <= to)
    }

    return list
  }, [referralsData, search, statusFilter, paymentFilter, discountFilter, dateFrom, dateTo])

  // Agrupar por referrer: mostrar solo la fila más reciente por referrer_code
  const displayRows = useMemo(() => {
    const grouped = new Map()
    for (const r of filtered) {
      const key = r.referrer?.referrer_code ?? r.referralHsId
      const existing = grouped.get(key)
      if (!existing) {
        grouped.set(key, r)
      } else {
        const dExisting = new Date(existing.created_date ?? 0)
        const dCurrent  = new Date(r.created_date ?? 0)
        if (dCurrent > dExisting) grouped.set(key, r)
      }
    }
    return Array.from(grouped.values())
      .sort((a, b) => new Date(b.created_date ?? 0) - new Date(a.created_date ?? 0))
  }, [filtered])

  const totalPages = Math.max(1, Math.ceil(displayRows.length / PAGE_SIZE))
  const referrals  = displayRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  useEffect(() => { setPage(1) }, [search, statusFilter, paymentFilter, discountFilter, dateFrom, dateTo, unit])

  const hasActiveFilters = Boolean(search || statusFilter || paymentFilter || discountFilter || dateFrom || dateTo)

  function handleRefetch() {
    refetch()
      .then(() => setToast({ message: 'Data updated successfully', type: 'success' }))
      .catch(() => setToast({ message: 'Error connecting to n8n', type: 'error' }))
  }

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setPaymentFilter('')
    setDiscountFilter('')
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary shadow-[0_1px_12px_rgba(16,21,66,0.25)]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
          <span className="text-white font-semibold tracking-tight text-sm">
            PropHero · Referrals
          </span>

          <div className="flex items-center gap-2">
            {/* Unit selector */}
            <div className="flex items-center gap-0.5 rounded-lg bg-white/10 p-1">
              {UNITS.map(u => (
                <button
                  key={String(u.value)}
                  onClick={() => setUnit(u.value)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all duration-150 ${
                    unit === u.value
                      ? 'bg-white text-primary shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {u.label}
                </button>
              ))}
            </div>

            {/* Last updated + Refresh */}
            <div className="flex items-center gap-2">
              {dataUpdatedAt > 0 && (
                <span className="text-xs text-white/50 tabular-nums">
                  last updated {new Date(dataUpdatedAt).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} - {new Date(dataUpdatedAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button
                onClick={handleRefetch}
                disabled={isFetching}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/20 hover:text-white transition-all duration-150 disabled:opacity-40 active:scale-95"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${isFetching ? 'animate-spin' : ''}`}
                  fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => setShowExport(true)}
                disabled={!filtered.length}
                className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/20 hover:text-white transition-all duration-150 disabled:opacity-40 active:scale-95"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export
              </button>

              {/* Separador + usuario + logout */}
              <div className="ml-1 flex items-center gap-2 border-l border-white/15 pl-3">
                {user?.email && (
                  <span className="hidden sm:inline text-xs text-white/50 max-w-[160px] truncate" title={user.email}>
                    {user.email}
                  </span>
                )}
                <button
                  onClick={logout}
                  title="Sign out"
                  className="flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white/80 hover:bg-white/20 hover:text-white transition-all duration-150 active:scale-95"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
                  </svg>
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-5">

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <KPICard
            title="Total Referrals"
            value={totalReferrals ?? '—'}
            loading={referralsLoading}
          />
          <KPICard
            title="Total Referrers"
            value={totalReferrers ?? '—'}
            loading={referralsLoading}
          />
          <KPICard
            title="Referrer Paid"
            value={kpisData ? formatEur(kpisData.referrerAmountPaid) : '—'}
            loading={kpisLoading}
          />
          <KPICard
            title="Applied Discounts"
            value={kpisData ? formatEur(kpisData.referidoAmountApplied) : '—'}
            loading={kpisLoading}
          />
          <KPICard
            title="Pending"
            value={kpisData?.byStatus?.created ?? '—'}
            subtitle="in created status"
            loading={kpisLoading}
          />
        </div>

        {/* Search + Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="w-44 shrink-0">
            <SearchBar value={search} onChange={setSearch} placeholder="Search..." />
          </div>
          <div className="flex gap-2 flex-wrap items-center">
            <DateInput value={dateFrom} onChange={setDateFrom} placeholder="From date" />
            <DateInput value={dateTo}   onChange={setDateTo}   placeholder="To date" />
            <FilterSelect value={statusFilter}   onChange={setStatusFilter}   options={REFERRAL_STATUS_OPTIONS} />
            <FilterSelect value={paymentFilter}  onChange={setPaymentFilter}  options={PAYMENT_STATUS_OPTIONS}  />
            <FilterSelect value={discountFilter} onChange={setDiscountFilter} options={DISCOUNT_STATUS_OPTIONS} />
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-xs text-slate-400 hover:text-slate-600 transition-colors underline underline-offset-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Error banner */}
        {referralsError && (
          <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
            <svg className="h-4 w-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <p className="text-sm text-rose-700">
              Failed to load referrals. Your session may have expired, or n8n is unavailable.
            </p>
          </div>
        )}

        {/* Row count */}
        {!referralsLoading && !referralsError && (
          <p className="text-xs text-slate-400 -mb-1">
            {displayRows.length} referrer{displayRows.length !== 1 ? 's' : ''}
            {filtered.length !== displayRows.length
              ? ` · ${filtered.length} referral${filtered.length !== 1 ? 's' : ''}`
              : ''}
            {referralsData?.total !== undefined && filtered.length !== referralsData?.total
              ? ` (filtrado de ${referralsData?.total} total)`
              : ''}
          </p>
        )}

        <ReferralTable
          referrals={referrals}
          loading={referralsLoading}
          onRowClick={id => navigate(`/referral/${id}`)}
        />

        {/* Pagination */}
        {!referralsLoading && totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-xs text-slate-400">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                </svg>
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </button>
            </div>
          </div>
        )}
      </main>

      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}

      {showExport && (
        <ExportModal
          referrals={filtered}
          onClose={() => setShowExport(false)}
        />
      )}
    </div>
  )
}
