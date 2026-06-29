import { describe, it, expect } from 'vitest'
import { productChoiceToProgram, PROGRAMS, PROGRAM_LABELS } from './program'

describe('productChoiceToProgram', () => {
  it('Traditional y New Build → SP', () => {
    expect(productChoiceToProgram('Traditional')).toBe('SP')
    expect(productChoiceToProgram('New Build')).toBe('SP')
  })

  it('ValueHero → VH', () => {
    expect(productChoiceToProgram('ValueHero')).toBe('VH')
  })

  it('IreHero → IH', () => {
    expect(productChoiceToProgram('IreHero')).toBe('IH')
  })

  it('null/undefined/vacío → null (sin etiqueta)', () => {
    expect(productChoiceToProgram(null)).toBeNull()
    expect(productChoiceToProgram(undefined)).toBeNull()
    expect(productChoiceToProgram('')).toBeNull()
  })

  it('valor desconocido → null (no rompe filas viejas)', () => {
    expect(productChoiceToProgram('Whatever')).toBeNull()
    expect(productChoiceToProgram('SP')).toBeNull() // el código de programa NO es un product_choice válido
  })

  it('es case-sensitive (los valores internos vienen exactos del deal)', () => {
    expect(productChoiceToProgram('traditional')).toBeNull()
    expect(productChoiceToProgram('valuehero')).toBeNull()
  })
})

describe('constantes de programa', () => {
  it('PROGRAMS son exactamente SP, VH, IH en orden', () => {
    expect(PROGRAMS).toEqual(['SP', 'VH', 'IH'])
  })

  it('PROGRAM_LABELS = etiqueta de producto por programa (SP muestra ambos)', () => {
    expect(PROGRAM_LABELS).toEqual({ SP: 'Traditional / New Build', VH: 'ValueHero', IH: 'IreHero' })
  })

  it('todo product_choice válido mapea a un programa de PROGRAMS', () => {
    for (const pc of ['Traditional', 'New Build', 'ValueHero', 'IreHero']) {
      expect(PROGRAMS).toContain(productChoiceToProgram(pc))
    }
  })
})
