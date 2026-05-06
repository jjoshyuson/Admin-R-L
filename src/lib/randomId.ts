function fallbackHexSegment(length: number) {
  let output = ''
  while (output.length < length) {
    output += Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')
  }
  return output.slice(0, length)
}

function buildUuidFromBytes(bytes: Uint8Array) {
  const normalized = new Uint8Array(bytes)
  normalized[6] = (normalized[6] & 0x0f) | 0x40
  normalized[8] = (normalized[8] & 0x3f) | 0x80
  const hex = Array.from(normalized, (value) => value.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`
}

export function createRandomId(_prefix = 'id') {
  const cryptoObject = globalThis.crypto
  if (cryptoObject && typeof cryptoObject.randomUUID === 'function') {
    return cryptoObject.randomUUID()
  }

  if (cryptoObject && typeof cryptoObject.getRandomValues === 'function') {
    const values = new Uint8Array(16)
    cryptoObject.getRandomValues(values)
    return buildUuidFromBytes(values)
  }

  const fallbackHex = `${Date.now().toString(16).padStart(12, '0')}${fallbackHexSegment(20)}`
  return `${fallbackHex.slice(0, 8)}-${fallbackHex.slice(8, 12)}-4${fallbackHex.slice(13, 16)}-a${fallbackHex.slice(17, 20)}-${fallbackHex.slice(20, 32)}`
}
