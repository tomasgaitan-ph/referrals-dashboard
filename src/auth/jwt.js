// Helpers puros para manejar el ID token de Google (JWT) en el cliente.
// La verificación de FIRMA real ocurre en n8n; acá solo decodificamos claims
// para UX (mostrar usuario, gatear acceso por dominio y detectar expiración).

export const PROPHERO_DOMAIN = 'prophero.com'

// Decodifica el payload de un JWT (base64url) sin verificar la firma.
// Devuelve el objeto de claims, o null si el token es inválido.
export function decodeJwt(token) {
  if (typeof token !== 'string') return null
  const parts = token.split('.')
  if (parts.length !== 3) return null
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    const binary = atob(padded)
    // Decodificar como UTF-8 para soportar nombres con acentos/ñ.
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
    const json = new TextDecoder().decode(bytes)
    return JSON.parse(json)
  } catch {
    return null
  }
}

// Verifica que el token corresponda a una cuenta @prophero.com verificada.
export function isProphero(claims) {
  if (!claims || typeof claims !== 'object') return false
  const verified = claims.email_verified === true || claims.email_verified === 'true'
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : ''
  return verified && email.endsWith(`@${PROPHERO_DOMAIN}`)
}

// Verifica si el token ya expiró (claim `exp` en segundos).
export function isExpired(claims, now = Date.now()) {
  if (!claims || typeof claims.exp !== 'number') return true
  return now >= claims.exp * 1000
}
