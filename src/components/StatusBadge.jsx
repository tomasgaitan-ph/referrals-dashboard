const STATUS_CONFIG = {
  created:  { label: 'Created', classes: 'bg-slate-100 text-slate-600 border-slate-200' },
  paid:     { label: 'Paid',    classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  pending:  { label: 'Pending', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
  applied:  { label: 'Applied', classes: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  not_applicable: { label: 'Not applicable', classes: 'bg-slate-100 text-slate-500 border-slate-200' },
  // Estado derivado (solo display): pago al referrer pendiente con el descuento ya
  // aplicado → listo para transferir. No es un valor real de HubSpot.
  ready_to_transfer: { label: 'Ready to transfer', classes: 'bg-amber-50 text-amber-700 border-amber-200' },
}

export default function StatusBadge({ status }) {
  const config = STATUS_CONFIG[status] ?? {
    label: status ?? '—',
    classes: 'bg-slate-100 text-slate-500 border-slate-200',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.classes}`}>
      {config.label}
    </span>
  )
}
