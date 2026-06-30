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

// Etiqueta de display del programa = nombre(s) del producto del deal. SP agrupa dos
// productos (Traditional + New Build) → muestra ambos. Se usa como texto del chip
// (ProgramBadge) y de las opciones del filtro de programa. En inglés, igual a los
// valores de product_choice del back.
export const PROGRAM_LABELS = {
  SP: 'Traditional / New Build',
  VH: 'ValueHero',
  IH: 'IreHero',
}

// product_choice → 'SP' | 'VH' | 'IH' | null. null/vacío/desconocido → null
// (se muestra sin etiqueta). No rompe filas viejas sin product_choice.
export function productChoiceToProgram(productChoice) {
  if (!productChoice) return null
  return PRODUCT_CHOICE_TO_PROGRAM[productChoice] ?? null
}

// Requisitos (SOLO display) para habilitar el pago al referrer, por programa. La
// habilitación REAL la decide el back vía canMarkReferrerPaid; esto sólo le explica
// al usuario qué condiciones hacen falta. Mantener en sync con la lógica del back.
// Asimetría intencional: SP gatea por Pre-settlement + Real Settlement Date; VH/IH
// gatean SÓLO por Investment Ticket en Closed Won (el back NO chequea
// real_settlement_date para VH/IH). No volver a agregar RSD a VH/IH.
export const PROGRAM_PAYMENT_REQUIREMENTS = {
  SP: ['Deal in Pre-settlement', 'Real Settlement Date set'],
  VH: ['Investment Ticket in Closed Won'],
  IH: ['Investment Ticket in Closed Won'],
}

// Texto genérico cuando no se conoce el programa (deal sin product_choice).
export const PAYMENT_REQUIREMENTS_FALLBACK = 'Requires the deal to reach its settlement condition'

// Lista de requisitos a mostrar para un product_choice dado, o null si no hay
// programa (→ usar PAYMENT_REQUIREMENTS_FALLBACK).
export function paymentRequirements(productChoice) {
  const program = productChoiceToProgram(productChoice)
  return program ? PROGRAM_PAYMENT_REQUIREMENTS[program] : null
}
