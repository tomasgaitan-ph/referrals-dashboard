export default function KPICard({ title, value, subtitle, loading = false }) {
  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-[0_2px_8px_-2px_rgba(26,60,94,0.06)] animate-pulse">
        <div className="h-3 w-24 bg-slate-200 rounded" />
        <div className="mt-3 h-8 w-20 bg-slate-200 rounded" />
        <div className="mt-2 h-3 w-16 bg-slate-100 rounded" />
      </div>
    )
  }

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-[0_2px_8px_-2px_rgba(26,60,94,0.06)]">
      <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
      <p className="mt-2 text-3xl font-semibold text-primary font-mono tabular-nums">{value}</p>
      {subtitle && <p className="mt-1 text-sm text-slate-400">{subtitle}</p>}
    </div>
  )
}
