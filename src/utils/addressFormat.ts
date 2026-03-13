import { sha256 } from '@noble/hashes/sha2.js'

const ADDRESS_HEX_RE = /^[0-9a-f]{40}$/i
const WEBD_PREFIX = 'WEBD$'

const ADDRESS_WIF_TOTAL_LENGTH = 30
const PREFIX_BYTES = [0x58, 0x40, 0x43, 0xfe]
const SUFFIX_BYTE = 0xff
const VERSION_BYTE = 0x00

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

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function encodeWebdBase64(bytes: Uint8Array): string {
  return toBase64(bytes)
    .replace(/O/g, '#')
    .replace(/l/g, '@')
    .replace(/\//g, '$')
}

function decodeWebdBase64(value: string): Uint8Array {
  const normalized = value
    .replace(/#/g, 'O')
    .replace(/@/g, 'l')
    .replace(/\$/g, '/')
  return base64ToBytes(normalized)
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

function equalBytes(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false
  }
  return true
}

export function toHexAddressFromWebdWallet(value: string): string | null {
  const raw = String(value ?? '').trim()
  if (!raw.startsWith(WEBD_PREFIX)) return null

  try {
    const bytes = decodeWebdBase64(raw)
    if (bytes.length !== ADDRESS_WIF_TOTAL_LENGTH) return null

    if (!PREFIX_BYTES.every((byte, index) => bytes[index] === byte)) return null
    if (bytes[bytes.length - 1] !== SUFFIX_BYTE) return null

    const addressWithVersion = bytes.slice(4, 25)
    if (addressWithVersion[0] !== VERSION_BYTE) return null

    const checksum = bytes.slice(25, 29)
    const expectedChecksum = sha256(sha256(addressWithVersion)).slice(0, 4)
    if (!equalBytes(checksum, expectedChecksum)) return null

    return bytesToHex(addressWithVersion.slice(1))
  } catch {
    return null
  }
}

export function normalizeAddressForLookup(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const decoded = toHexAddressFromWebdWallet(raw)
  return decoded ?? raw
}

export function formatAddressDisplay(value: unknown): string {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  if (raw.startsWith(WEBD_PREFIX)) return raw
  if (ADDRESS_HEX_RE.test(raw)) return toWebdWalletAddressFromHex(raw)
  return raw
}
