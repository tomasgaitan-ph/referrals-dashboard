import { useState, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useReferralDetail } from '../hooks/useReferralDetail'
import { useReferrals } from '../hooks/useReferrals'
import { markReferrerPaid } from '../api/hubspot'
import { referrerPaymentStatus } from '../lib/referralFilters'
import { latestDataUpdate, formatLastUpdated } from '../lib/lastUpdated'
import logo from '../assets/logoph.png'
import StatusBadge from '../components/StatusBadge'
import ProgramBadge from '../components/ProgramBadge'
import Toast from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

// Dealstage de HubSpot que habilita el pago manual al referrer (pre-settlement).
const PRE_SETTLEMENT_STAGE = '257909958'

// Labels legibles para los dealstage IDs conocidos. Para IDs no mapeados se
// muestra el ID crudo (la lista de stages no está disponible client-side).
const DEAL_STAGE_LABELS = {
  [PRE_SETTLEMENT_STAGE]: 'Pre-settlement',
}

function dealStageLabel(stage) {
  if (!stage) return '—'
  return DEAL_STAGE_LABELS[stage] ?? stage
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function formatEur(n) {
  if (n === null || n === undefined) return '—'
  return `€${Number(n).toLocaleString('es-ES', { minimumFractionDigits: 0 })}`
}

function fullName(contact) {
  if (!contact) return '—'
  return [contact.firstname, contact.lastname].filter(Boolean).join(' ') || '—'
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Card({ title, children, className = '' }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 shadow-[0_2px_8px_-2px_rgba(26,60,94,0.06)] ${className}`}>
      {title && (
        <div className="px-5 py-3.5 border-b border-slate-100">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</h2>
        </div>
      )}
      <div className="px-5 py-4">{children}</div>
    </div>
  )
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-400 mb-0.5">{label}</dt>
      <dd className="text-sm text-slate-700">{children}</dd>
    </div>
  )
}

function ChecklistItem({ met, children }) {
  return (
    <li className={`flex items-center gap-2 text-xs ${met ? 'text-emerald-700' : 'text-slate-400'}`}>
      {met ? (
        <svg className="h-4 w-4 shrink-0 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ) : (
        <svg className="h-4 w-4 shrink-0 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 9.75l4.5 4.5m0-4.5-4.5 4.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      )}
      {children}
    </li>
  )
}

function SkeletonCard({ lines = 4 }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-[0_2px_8px_-2px_rgba(26,60,94,0.06)] animate-pulse">
      <div className="px-5 py-3.5 border-b border-slate-100">
        <div className="h-3 w-24 rounded bg-slate-200" />
      </div>
      <div className="px-5 py-4 space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="space-y-1">
            <div className="h-2.5 w-16 rounded bg-slate-100" />
            <div className="h-3.5 w-40 rounded bg-slate-200" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function ReferralDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data, isLoading, isError, error, isFetching, refetch } = useReferralDetail(id)
  const { data: listData } = useReferrals()

  const [toast, setToast] = useState(null)
  const [confirmPay, setConfirmPay] = useState(false)

  const { mutate: markPaid, isPending: marking } = useMutation({
    mutationFn: () => markReferrerPaid(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["referral", id] })
      queryClient.invalidateQueries({ queryKey: ["referrals"] })
      queryClient.invalidateQueries({ queryKey: ["kpis"] })
      // El back responde 200 { info } cuando ya estaba pagado (idempotente).
      setToast(
        result?.info
          ? { message: "Referrer was already marked as paid", type: "info" }
          : { message: "Referrer marked as paid", type: "success" },
      )
    },
    onError: (err) => setToast({ message: err.message ?? "Error marking referrer as paid", type: "error" }),
  })

  function handleRefetch() {
    refetch()
      .then(() => setToast({ message: 'Data updated successfully', type: 'success' }))
      .catch(() => setToast({ message: 'Error connecting to n8n', type: 'error' }))
  }

  const referral = data?.referral
  const referrer = data?.referrer
  const referido = data?.referido
  const deal     = data?.deal

  // "last updated" único: mismo valor que el header del dashboard y el recordatorio.
  const lastUpdated = latestDataUpdate(queryClient)

  const alreadyPaid = referral?.referrer_payment_status === 'paid'
  // El back habilita el pago manual sólo con el deal en pre-settlement y con
  // real_settlement_date cargada. El front replica el guard (el back revalida).
  const dealEligible = deal?.dealstage === PRE_SETTLEMENT_STAGE && !!deal?.real_settlement_date
  const canMarkPaid = dealEligible && !alreadyPaid

  const siblings = useMemo(() => {
    if (!referrer?.referrer_code) return []
    return (listData?.referrals ?? [])
      .filter(r => r.referrer?.referrer_code === referrer.referrer_code)
      .sort((a, b) => new Date(b.created_date ?? 0) - new Date(a.created_date ?? 0))
  }, [listData, referrer])

  const siblingIdx  = siblings.findIndex(s => String(s.referralHsId) === String(id))
  const hasSiblings = siblings.length > 1 && siblingIdx !== -1

  return (
    <div className="min-h-screen bg-background">

      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary shadow-[0_1px_12px_rgba(16,21,66,0.25)]">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center gap-3">
          <img src={logo} alt="PropHero" className="h-8 w-8 rounded-md" />
          <Link
            to="/"
            className="flex items-center gap-1.5 text-white/60 hover:text-white transition-colors"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            <span className="text-xs">Dashboard</span>
          </Link>
          <span className="text-white/30 text-sm">/</span>
          <span className="text-white text-sm font-medium font-mono">
            {isLoading ? '…' : (referral?.referral_id ?? id)}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {hasSiblings && !isLoading && (
              <span className="text-xs text-white/40 tabular-nums">
                {siblingIdx + 1} / {siblings.length}
              </span>
            )}
            {lastUpdated > 0 && (
              <span className="text-xs text-white/50 tabular-nums">
                last updated {formatLastUpdated(lastUpdated)}
              </span>
            )}
            <button
              onClick={handleRefetch}
              disabled={isFetching}
              className="flex items-center gap-1.5 rounded-lg border border-white/20 px-3 py-1.5 text-xs font-medium text-white/70 hover:text-white hover:border-white/40 transition-colors disabled:opacity-40"
            >
              <svg className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">

        {/* Error state */}
        {isError && (
          <div className="flex items-center gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3">
            <svg className="h-4 w-4 shrink-0 text-rose-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9.303 3.376c.866 1.5-.217 3.374-1.948 3.374H4.645c-1.73 0-2.813-1.874-1.948-3.374L10.051 3.378c.866-1.5 3.032-1.5 3.898 0L21.303 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
            <p className="text-sm text-rose-700">
              {error?.message ?? 'Failed to load referral.'}
            </p>
          </div>
        )}

        {/* Content grid */}
        {!isError && (
          <div className="space-y-5">

            {/* Fila 1: Deal (izq) + Information (principal) */}
            <div className="grid gap-5 lg:grid-cols-3">

              {/* Deal */}
              {isLoading ? <SkeletonCard lines={3} /> : (
                <Card title="Deal">
                  {deal ? (
                    <dl className="space-y-3">
                      <Field label="Name">{deal.dealname ?? '—'}</Field>
                      <Field label="Pipeline">{deal.pipeline ?? '—'}</Field>
                      <Field label="Stage">{dealStageLabel(deal.dealstage)}</Field>
                      <Field label="Settlement date">{formatDate(deal.real_settlement_date)}</Field>
                      <div className="pt-1">
                        <a
                          href={deal.hubspotUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-secondary hover:text-secondary transition-colors active:scale-[0.98]"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                          </svg>
                          View in HubSpot
                        </a>
                      </div>
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-400">No deal associated.</p>
                  )}
                </Card>
              )}

              {/* Information */}
              {isLoading ? <SkeletonCard lines={6} /> : (
                <Card title="Information" className="lg:col-span-2">
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                    <Field label="ID">
                      <span className="font-mono text-xs">{referral?.referral_id ?? '—'}</span>
                    </Field>
                    <Field label="Unique ID">
                      <span className="font-mono text-xs">{referral?.unique_id ?? '—'}</span>
                    </Field>
                    <Field label="Program">
                      <ProgramBadge productChoice={deal?.product_choice} />
                    </Field>
                    <Field label="Created date">
                      <span className="font-mono text-xs">{formatDate(referral?.created_date)}</span>
                    </Field>
                    <Field label="Referral status">
                      <StatusBadge status={referral?.referral_status} />
                    </Field>
                    <Field label="Referrer payment">
                      <StatusBadge status={referrerPaymentStatus(referral)} />
                    </Field>
                    <Field label="Referrer payment date">
                      <span className="font-mono text-xs">{formatDate(referral?.referrer_payment_date)}</span>
                    </Field>
                    <Field label="Referrer amount">
                      <span className="font-mono">{formatEur(referral?.referrer_amount)}</span>
                    </Field>
                    <Field label="Referral discount">
                      <StatusBadge status={referral?.referido_discount_status} />
                    </Field>
                    <Field label="Discount date">
                      <span className="font-mono text-xs">{formatDate(referral?.referido_discount_date)}</span>
                    </Field>
                    <Field label="Referral amount">
                      <span className="font-mono">{formatEur(referral?.referido_amount)}</span>
                    </Field>
                  </dl>
                </Card>
              )}
            </div>

            {/* Fila 2: Referrer payment (marcado manual) */}
            {!isLoading && referral && (
              <Card title="Referrer payment">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-slate-500">
                    Mark the €500 referrer payment as paid once finance has completed the transfer.
                  </p>
                  <button
                    onClick={() => setConfirmPay(true)}
                    disabled={marking || !canMarkPaid}
                    className="shrink-0 flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-white hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]"
                  >
                    {marking
                      ? <><svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>Marking…</>
                      : <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>Mark as paid</>
                    }
                  </button>
                </div>
                {alreadyPaid ? (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-emerald-600">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                    Referrer payment already completed.
                  </p>
                ) : (
                  <div className="mt-4 pt-3 border-t border-slate-100">
                    <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400">Requirements to enable</p>
                    <ul className="space-y-1.5">
                      <ChecklistItem met={deal?.dealstage === PRE_SETTLEMENT_STAGE}>Deal in pre-settlement</ChecklistItem>
                      <ChecklistItem met={!!deal?.real_settlement_date}>Settlement date set</ChecklistItem>
                    </ul>
                  </div>
                )}
              </Card>
            )}

            {/* Fila 3: Referrer + Referral */}
            <div className="grid gap-5 sm:grid-cols-2">

              {/* Referrer */}
              {isLoading ? <SkeletonCard lines={6} /> : (
                <Card title="Referrer">
                  {referrer ? (
                    <dl className="space-y-3">
                      <Field label="Name">{fullName(referrer)}</Field>
                      <Field label="Email">
                        <a href={`mailto:${referrer.email}`} className="text-secondary hover:underline break-all">
                          {referrer.email ?? '—'}
                        </a>
                      </Field>
                      <Field label="Referrer code">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                          {referrer.referrer_code ?? '—'}
                        </span>
                      </Field>
                      <Field label="Total referrals">{referrer.total_referrals ?? '—'}</Field>
                      <Field label="Total earned">{formatEur(referrer.total_earned)}</Field>
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-400">No referrer associated.</p>
                  )}
                </Card>
              )}

              {/* Referral */}
              {isLoading ? <SkeletonCard lines={3} /> : (
                <Card title="Referral">
                  {referido ? (
                    <dl className="space-y-3">
                      <Field label="Name">{fullName(referido)}</Field>
                      <Field label="Email">
                        <a href={`mailto:${referido.email}`} className="text-secondary hover:underline break-all">
                          {referido.email ?? '—'}
                        </a>
                      </Field>
                      <Field label="Referred by">
                        <span className="font-mono text-xs bg-slate-100 px-2 py-0.5 rounded">
                          {referido.referred_by_code ?? '—'}
                        </span>
                      </Field>
                    </dl>
                  ) : (
                    <p className="text-sm text-slate-400">No referred associated.</p>
                  )}
                </Card>
              )}

            </div>
          </div>
        )}
      </main>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <ConfirmDialog
        open={confirmPay}
        title="Mark referrer as paid"
        message="This marks the €500 referrer payment as paid and updates the referral status. Confirm only after finance has completed the transfer."
        confirmLabel={marking ? 'Marking…' : 'Mark as paid'}
        loading={marking}
        onConfirm={() => { markPaid(); setConfirmPay(false) }}
        onClose={() => setConfirmPay(false)}
      />

      {hasSiblings && !isLoading && (
        <>
          <button
            onClick={() => navigate(`/referral/${siblings[siblingIdx - 1].referralHsId}`)}
            disabled={siblingIdx <= 0}
            title={siblingIdx > 0 ? siblings[siblingIdx - 1].referral_id : undefined}
            className="fixed left-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary hover:shadow-xl transition-all disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:border-slate-200 disabled:hover:shadow-lg"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
          </button>
          <button
            onClick={() => navigate(`/referral/${siblings[siblingIdx + 1].referralHsId}`)}
            disabled={siblingIdx >= siblings.length - 1}
            title={siblingIdx < siblings.length - 1 ? siblings[siblingIdx + 1].referral_id : undefined}
            className="fixed right-4 top-1/2 -translate-y-1/2 z-30 w-11 h-11 rounded-full bg-white border border-slate-200 shadow-lg flex items-center justify-center text-slate-400 hover:text-primary hover:border-primary hover:shadow-xl transition-all disabled:opacity-20 disabled:cursor-not-allowed disabled:hover:text-slate-400 disabled:hover:border-slate-200 disabled:hover:shadow-lg"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
            </svg>
          </button>
        </>
      )}
    </div>
  )
}
