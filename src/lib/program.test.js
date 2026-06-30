import { describe, it, expect } from 'vitest'
import { productChoiceToProgram, PROGRAMS, PROGRAM_LABELS, paymentRequirements, PAYMENT_REQUIREMENTS_FALLBACK } from './program'

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

describe('paymentRequirements (display de condiciones por programa)', () => {
  it('SP (Traditional / New Build) → Pre-settlement + Real Settlement Date', () => {
    const expected = ['Deal in Pre-settlement', 'Real Settlement Date set']
    expect(paymentRequirements('Traditional')).toEqual(expected)
    expect(paymentRequirements('New Build')).toEqual(expected)
  })

  it('VH y IH → solo Investment Ticket in Closed Won (el back NO gatea por Real Settlement Date)', () => {
    const expected = ['Investment Ticket in Closed Won']
    expect(paymentRequirements('ValueHero')).toEqual(expected)
    expect(paymentRequirements('IreHero')).toEqual(expected)
  })

  it('solo SP exige "Real Settlement Date set"; VH/IH no', () => {
    expect(paymentRequirements('Traditional')).toContain('Real Settlement Date set')
    expect(paymentRequirements('New Build')).toContain('Real Settlement Date set')
    expect(paymentRequirements('ValueHero')).not.toContain('Real Settlement Date set')
    expect(paymentRequirements('IreHero')).not.toContain('Real Settlement Date set')
  })

  it('null/vacío/desconocido → null (el caller usa el fallback)', () => {
    expect(paymentRequirements(null)).toBeNull()
    expect(paymentRequirements('')).toBeNull()
    expect(paymentRequirements('Whatever')).toBeNull()
  })

  it('hay un texto de fallback no vacío', () => {
    expect(typeof PAYMENT_REQUIREMENTS_FALLBACK).toBe('string')
    expect(PAYMENT_REQUIREMENTS_FALLBACK.length).toBeGreaterThan(0)
  })
})
