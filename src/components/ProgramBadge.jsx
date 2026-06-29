import { productChoiceToProgram, PROGRAM_LABELS } from '../lib/program'

// Clases del chip por programa. SP/VH conservan sus colores previos; IH usa teal
// (distinto de los colores de StatusBadge para no confundir programa con estado).
const PROGRAM_BADGE_CLASSES = {
  SP: 'bg-blue-50 text-blue-700 border-blue-200',
  VH: 'bg-violet-50 text-violet-700 border-violet-200',
  IH: 'bg-teal-50 text-teal-700 border-teal-200',
}

// Chip de programa derivado de deal.product_choice. Sin programa (null/vacío/
// desconocido) → '—'. Fuente única de render del programa en lista y detalle.
export default function ProgramBadge({ productChoice }) {
  const program = productChoiceToProgram(productChoice)
  if (!program) return '—'
  return (
    <span
      title={PROGRAM_LABELS[program]}
      className={`inline-flex items-center px-2 py-0.5 rounded border text-xs font-semibold ${PROGRAM_BADGE_CLASSES[program]}`}
    >
      {program}
    </span>
  )
}
