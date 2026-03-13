import { sha256 } from '@noble/hashes/sha2.js'

const ADDRESS_HEX_RE = /^[0-9a-f]{40}$/i

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return bytes
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function encodeWebdBase64(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replace(/O/g, '#')
    .replace(/l/g, '@')
    .replace(/\//g, '$')
}

function toWebdWalletAddressFromHex(hexAddress: string): string {
  const rawAddress = hexToBytes(hexAddress)

  // Node logic: version(00) + address(20 bytes) + checksum(4 bytes), wrapped with WEBD$ prefix/suffix bytes.
  const addressWithVersion = new Uint8Array(1 + rawAddress.length)
  addressWithVersion[0] = 0x00
  addressWithVersion.set(rawAddress, 1)

  const checksum = sha256(sha256(addressWithVersion)).slice(0, 4)

  const out = new Uint8Array(4 + addressWithVersion.length + checksum.length + 1)
  out.set([0x58, 0x40, 0x43, 0xfe], 0)
  out.set(addressWithVersion, 4)
  out.set(checksum, 4 + addressWithVersion.length)
  out[out.length - 1] = 0xff

  return encodeWebdBase64(out)
}

export function formatAddressDisplay(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (raw.startsWith('WEBD$')) return raw
  if (ADDRESS_HEX_RE.test(raw)) return toWebdWalletAddressFromHex(raw)
  return raw
}
