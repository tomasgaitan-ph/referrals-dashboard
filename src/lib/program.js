// Mapeo del producto del deal (product_choice de OPS) al programa que muestra el
// dashboard. `unit` quedó hardcodeado en SP en el back y NO es confiable, así que
// el programa se deriva siempre de deal.product_choice (fuente de verdad).

const PRODUCT_CHOICE_TO_PROGRAM = {
  Traditional: 'SP',
  'New Build': 'SP',
  ValueHero: 'VH',
  IreHero: 'IH',
}

// Programas válidos, en orden del selector. El filtro por programa es client-side
// sobre la lista ya cargada (no hay parámetro server-side).
export const PROGRAMS = ['SP', 'VH', 'IH']

// Nombre largo de cada programa (tooltip del badge / referencia).
export const PROGRAM_LABELS = {
  SP: 'SaleProphet',
  VH: 'ValueHero',
  IH: 'IreHero',
}

// product_choice → 'SP' | 'VH' | 'IH' | null. null/vacío/desconocido → null
// (se muestra sin etiqueta). No rompe filas viejas sin product_choice.
export function productChoiceToProgram(productChoice) {
  if (!productChoice) return null
  return PRODUCT_CHOICE_TO_PROGRAM[productChoice] ?? null
}
