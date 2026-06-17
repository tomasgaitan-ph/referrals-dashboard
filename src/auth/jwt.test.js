import { describe, it, expect } from 'vitest'
import { decodeJwt, isProphero, isExpired, PROPHERO_DOMAIN } from './jwt'

// Construye un JWT de prueba (header.payload.signature) con el payload dado.
function makeToken(payload) {
  const enc = obj => Buffer.from(JSON.stringify(obj)).toString('base64url')
  return `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc(payload)}.fake-signature`
}

const NOW = 1_700_000_000_000 // timestamp fijo para tests deterministas
const FUTURE_EXP = Math.floor(NOW / 1000) + 3600 // +1h
const PAST_EXP = Math.floor(NOW / 1000) - 3600 // -1h

describe('decodeJwt', () => {
  it('decodifica el payload de un token válido', () => {
    const claims = decodeJwt(makeToken({ email: 'tom@prophero.com', exp: FUTURE_EXP }))
    expect(claims).toMatchObject({ email: 'tom@prophero.com', exp: FUTURE_EXP })
  })

  it('decodifica nombres con caracteres UTF-8 (acentos/ñ)', () => {
    const claims = decodeJwt(makeToken({ name: 'José Muñoz', email: 'jose@prophero.com' }))
    expect(claims.name).toBe('José Muñoz')
  })

  it('devuelve null para un token mal formado (no tiene 3 partes)', () => {
    expect(decodeJwt('abc.def')).toBeNull()
    expect(decodeJwt('not-a-token')).toBeNull()
  })

  it('devuelve null para entradas no-string', () => {
    expect(decodeJwt(null)).toBeNull()
    expect(decodeJwt(undefined)).toBeNull()
    expect(decodeJwt(12345)).toBeNull()
    expect(decodeJwt({})).toBeNull()
  })

  it('devuelve null si el payload no es JSON válido', () => {
    const garbage = `${Buffer.from('{}').toString('base64url')}.@@@notbase64@@@.sig`
    expect(decodeJwt(garbage)).toBeNull()
  })
})

describe('isProphero', () => {
  it('acepta una cuenta @prophero.com verificada', () => {
    expect(isProphero({ email: 'tom@prophero.com', email_verified: true })).toBe(true)
  })

  it('es case-insensitive en el email', () => {
    expect(isProphero({ email: 'Tom@ProPhero.Com', email_verified: true })).toBe(true)
  })

  it('rechaza dominios ajenos', () => {
    expect(isProphero({ email: 'tom@gmail.com', email_verified: true })).toBe(false)
  })

  it('rechaza intentos de spoofing del dominio', () => {
    // El dominio real es un sufijo distinto → no debe pasar.
    expect(isProphero({ email: 'attacker@prophero.com.evil.com', email_verified: true })).toBe(false)
    expect(isProphero({ email: 'user@sub.prophero.com', email_verified: true })).toBe(false)
    expect(isProphero({ email: 'prophero.com@gmail.com', email_verified: true })).toBe(false)
  })

  it('rechaza si el email no está verificado', () => {
    expect(isProphero({ email: 'tom@prophero.com', email_verified: false })).toBe(false)
    expect(isProphero({ email: 'tom@prophero.com' })).toBe(false)
  })

  it('rechaza claims vacíos o nulos', () => {
    expect(isProphero(null)).toBe(false)
    expect(isProphero(undefined)).toBe(false)
    expect(isProphero({})).toBe(false)
  })

  it('expone el dominio esperado', () => {
    expect(PROPHERO_DOMAIN).toBe('prophero.com')
  })
})

describe('isExpired', () => {
  it('es false para un token vigente', () => {
    expect(isExpired({ exp: FUTURE_EXP }, NOW)).toBe(false)
  })

  it('es true para un token vencido', () => {
    expect(isExpired({ exp: PAST_EXP }, NOW)).toBe(true)
  })

  it('es true en el instante exacto de expiración (límite)', () => {
    expect(isExpired({ exp: Math.floor(NOW / 1000) }, NOW)).toBe(true)
  })

  it('trata como expirado un token sin claim exp', () => {
    expect(isExpired({}, NOW)).toBe(true)
    expect(isExpired({ exp: 'no-numerico' }, NOW)).toBe(true)
  })

  it('trata como expirado claims nulos', () => {
    expect(isExpired(null, NOW)).toBe(true)
  })
})
