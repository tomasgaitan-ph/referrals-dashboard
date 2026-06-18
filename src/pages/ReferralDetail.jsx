import { useState, useEffect, useMemo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useReferralDetail } from '../hooks/useReferralDetail'
import { useReferrals } from '../hooks/useReferrals'
import { updateReferral, updateReferrerFiscalAndPay } from '../api/hubspot'
import StatusBadge from '../components/StatusBadge'
import Toast from '../components/Toast'
import ConfirmDialog from '../components/ConfirmDialog'

// ── Constants ────────────────────────────────────────────────────────────────

const REFERRAL_STATUS_OPTIONS  = [{ value: 'created', label: 'Created' }, { value: 'pending', label: 'Pending' }, { value: 'paid', label: 'Paid' }]
const PAYMENT_STATUS_OPTIONS   = [{ value: 'pending', label: 'Pending' }, { value: 'paid',    label: 'Paid'    }]
const DISCOUNT_STATUS_OPTIONS  = [{ value: 'not_applicable', label: 'Not applicable' }, { value: 'pending', label: 'Pending' }, { value: 'applied', label: 'Applied' }]

const EMPTY_FORM = {
  referral_status:          '',
  referrer_payment_status:  '',
  referrer_payment_date:    '',
  referido_discount_status: '',
  referido_discount_date:   '',
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-ES', {
    day: '2-digit', month: '2-digit', year: 'numeric',
  })
}

function toDateInput(dateStr) {
  if (!dateStr) return ''
  return String(dateStr).slice(0, 10)
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

function FormSelect({ label, value, onChange, options }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-secondary focus:ring-2 focus:ring-secondary/20 appearance-none cursor-pointer"
      >
        <option value="">No change</option>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  )
}

function FormDate({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs text-slate-500 mb-1">{label}</label>
      <input
        type="date"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:border-secondary focus:ring-2 focus:ring-secondary/20"
      />
    </div>
  )
}

function FormInput({ label, value, onChange, placeholder, missing }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs text-slate-500 mb-1">
        {label}
        {missing && <span className="inline-flex items-center rounded-full bg-amber-100 px-1.5 py-0.5 text-amber-700 text-[10px] font-medium">Missing</span>}
      </label>
      <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder || ""}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-700 outline-none transition-colors focus:ring-2 ${missing && !value ? "border-amber-300 focus:border-amber-400 focus:ring-amber-100" : "border-slate-200 focus:border-secondary focus:ring-secondary/20"}`}
      />
    </div>
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

  const [form,  setForm]  = useState(EMPTY_FORM)
  const [toast, setToast] = useState(null)
  const [fiscalForm, setFiscalForm] = useState({ iban: "", nif: "", address: "" })
  const [confirmFiscal, setConfirmFiscal] = useState(false)

  useEffect(() => {
    if (!data?.referral) return
    const r = data.referral
    setForm({
      referral_status:          r.referral_status          ?? '',
      referrer_payment_status:  r.referrer_payment_status  ?? '',
      referrer_payment_date:    toDateInput(r.referrer_payment_date),
      referido_discount_status: r.referido_discount_status ?? '',
      referido_discount_date:   toDateInput(r.referido_discount_date),
    })
    setFiscalForm({ iban: data?.referrer?.iban ?? "", nif: data?.referrer?.nif ?? "", address: data?.referrer?.address ?? "" })
  }, [data])

  const { mutate: save, isPending: saving } = useMutation({
    mutationFn: (properties) => updateReferral(id, properties),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral', id] })
      queryClient.invalidateQueries({ queryKey: ['referrals'] })
      queryClient.invalidateQueries({ queryKey: ['kpis'] })
      setToast({ message: 'Changes saved successfully', type: 'success' })
    },
    onError: (err) => {
      setToast({ message: err.message ?? 'Error saving changes', type: 'error' })
    },
  })

  const { mutate: saveFiscal, isPending: savingFiscal } = useMutation({
    mutationFn: () => updateReferrerFiscalAndPay(id, referrer?.id, fiscalForm),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referral", id] })
      queryClient.invalidateQueries({ queryKey: ["referrals"] })
      queryClient.invalidateQueries({ queryKey: ["kpis"] })
      setToast({ message: "Fiscal data saved and payment relaunched", type: "success" })
    },
    onError: (err) => setToast({ message: err.message ?? "Error saving fiscal data", type: "error" }),
  })

  function setField(key) {
    return (value) => setForm(prev => ({ ...prev, [key]: value }))
  }

  function handleSave() {
    const properties = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== '')
    )
    if (Object.keys(properties).length === 0) return
    save(properties)
  }

  function handleRefetch() {
    refetch()
      .then(() => setToast({ message: 'Data updated successfully', type: 'success' }))
      .catch(() => setToast({ message: 'Error connecting to n8n', type: 'error' }))
  }

  const referral = data?.referral
  const referrer = data?.referrer
  const referido = data?.referido
  const deal     = data?.deal

  const missingFiscal = referrer ? ["iban","nif","address"].filter(f => !referrer[f]) : []
  const alreadyPaid = referral?.referrer_payment_status === 'paid'

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

      <main className="max-w-7xl mx-auto px-6 py-8">

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
          <div className="grid lg:grid-cols-3 gap-5">

            {/* ── Left column ─────────────────────────────────── */}
            <div className="lg:col-span-2 space-y-5">

              {/* Referral */}
              {isLoading ? <SkeletonCard lines={6} /> : (
                <Card title="Referral">
                  <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-4">
                    <Field label="ID">
                      <span className="font-mono text-xs">{referral?.referral_id ?? '—'}</span>
                    </Field>
                    <Field label="Unique ID">
                      <span className="font-mono text-xs">{referral?.unique_id ?? '—'}</span>
                    </Field>
                    <Field label="Program">
                      {referral?.unit ? (
                        <span className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${
                          referral.unit === 'SP'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-violet-50 text-violet-700 border-violet-200'
                        }`}>{referral.unit}</span>
                      ) : '—'}
                    </Field>
                    <Field label="Created date">
                      <span className="font-mono text-xs">{formatDate(referral?.created_date)}</span>
                    </Field>
                    <Field label="Referral status">
                      <StatusBadge status={referral?.referral_status} />
                    </Field>
                    <Field label="Referrer payment">
                      <StatusBadge status={referral?.referrer_payment_status} />
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

              {/* Edit panel */}
              {isLoading ? <SkeletonCard lines={5} /> : (
                <Card title="Edit">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormSelect
                      label="Referral status"
                      value={form.referral_status}
                      onChange={setField('referral_status')}
                      options={REFERRAL_STATUS_OPTIONS}
                    />
                    <FormSelect
                      label="Referrer payment"
                      value={form.referrer_payment_status}
                      onChange={setField('referrer_payment_status')}
                      options={PAYMENT_STATUS_OPTIONS}
                    />
                    <FormDate
                      label="Referrer payment date"
                      value={form.referrer_payment_date}
                      onChange={setField('referrer_payment_date')}
                    />
                    <FormSelect
                      label="Referral discount"
                      value={form.referido_discount_status}
                      onChange={setField('referido_discount_status')}
                      options={DISCOUNT_STATUS_OPTIONS}
                    />
                    <FormDate
                      label="Referral discount date"
                      value={form.referido_discount_date}
                      onChange={setField('referido_discount_date')}
                    />
                  </div>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-400">
                      Amounts and unit are read-only.
                    </p>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-secondary transition-colors disabled:opacity-50 active:scale-[0.98]"
                    >
                      {saving && (
                        <svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                        </svg>
                      )}
                      {saving ? 'Saving…' : 'Save changes'}
                    </button>
                  </div>
                </Card>
              )}
            </div>

            {/* ── Right column ────────────────────────────────── */}
            <div className="space-y-5">

              {/* Referrer */}
              {isLoading ? <SkeletonCard lines={6} /> : (
                <Card title="Referrer">
                  {referrer ? (
                    <>
                      {missingFiscal.length > 0 && (
                        <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-3">
                          <svg className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" /></svg>
                          <div>
                            <p className="text-xs font-semibold text-amber-800">Incomplete fiscal data</p>
                            <p className="text-xs text-amber-700 mt-0.5">Missing: <span className="font-mono font-medium">{missingFiscal.join(", ")}</span></p>
                          </div>
                        </div>
                      )}
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
                        {referrer.iban && <Field label="IBAN"><span className="font-mono text-xs break-all">{referrer.iban}</span></Field>}
                        {referrer.nif  && <Field label="NIF"><span className="font-mono text-xs">{referrer.nif}</span></Field>}
                        {referrer.address && <Field label="Address">{referrer.address}</Field>}
                      </dl>
                    </>
                  ) : (
                    <p className="text-sm text-slate-400">No referrer associated.</p>
                  )}
                </Card>
              )}

              {/* Referrer fiscal data */}
              {!isLoading && referrer && (
                <Card title="Referrer fiscal data">
                  <div className="space-y-3">
                    <FormInput label="IBAN" value={fiscalForm.iban} onChange={v => setFiscalForm(p => ({...p, iban: v}))} placeholder="ES00 0000 0000 00 0000000000" missing={!referrer?.iban} />
                    <FormInput label="NIF" value={fiscalForm.nif} onChange={v => setFiscalForm(p => ({...p, nif: v}))} placeholder="12345678A" missing={!referrer?.nif} />
                    <FormInput label="Address" value={fiscalForm.address} onChange={v => setFiscalForm(p => ({...p, address: v}))} placeholder="Street, city, country" missing={!referrer?.address} />
                  </div>
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    <button onClick={() => setConfirmFiscal(true)} disabled={savingFiscal || alreadyPaid || !referrer?.id} className="w-full flex items-center justify-center gap-2 rounded-lg bg-secondary px-4 py-2.5 text-sm font-medium text-white hover:bg-secondary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]">
                      {savingFiscal
                        ? <><svg className="h-3.5 w-3.5 animate-spin" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" /></svg>Saving and relaunching payment…</>
                        : <><svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>Save and relaunch payment</>
                      }
                    </button>
                    {alreadyPaid && (
                      <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-emerald-600">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg>
                        Payment already completed — relaunch disabled.
                      </p>
                    )}
                    {!alreadyPaid && !referrer?.id && (
                      <p className="mt-2 text-center text-xs text-slate-400">
                        Referrer ID unavailable — cannot relaunch payment.
                      </p>
                    )}
                  </div>
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

              {/* Deal */}
              {isLoading ? <SkeletonCard lines={3} /> : (
                <Card title="Deal">
                  {deal ? (
                    <dl className="space-y-3">
                      <Field label="Name">{deal.dealname ?? '—'}</Field>
                      <Field label="Pipeline">{deal.pipeline ?? '—'}</Field>
                      <Field label="Stage">{deal.dealstage ?? '—'}</Field>
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

            </div>
          </div>
        )}
      </main>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <ConfirmDialog
        open={confirmFiscal}
        title="Relaunch payment"
        message={`This saves the fiscal data and relaunches the €${Number(referral?.referrer_amount ?? 500)} payment to the referrer. It triggers a real payment. Continue?`}
        confirmLabel={savingFiscal ? 'Relaunching…' : 'Relaunch payment'}
        loading={savingFiscal}
        onConfirm={() => { saveFiscal(); setConfirmFiscal(false) }}
        onClose={() => setConfirmFiscal(false)}
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
