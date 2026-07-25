const hourlyOrderCounterKey = 'pos-hourly-order-counter-v1'

type HourlyOrderCounter = {
  hourKey: string
  nextSequence: number
}

export type HourlyOrderNumber = {
  reference: string
  sequence: number
}

export function formatHourlyOrderNumber(createdAt: Date | number, sequence: number) {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const hour = String(date.getHours()).padStart(2, '0')
  return `${hour}-${String(sequence).padStart(3, '0')}`
}

export function peekHourlyOrderNumber(createdAt: Date | number = Date.now()) {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const counter = readCounter(date)
  return formatHourlyOrderNumber(date, counter.nextSequence)
}

export function reserveHourlyOrderNumber(createdAt: Date | number = Date.now()): HourlyOrderNumber {
  const date = createdAt instanceof Date ? createdAt : new Date(createdAt)
  const counter = readCounter(date)
  if (counter.nextSequence > 999) {
    throw new Error('This hour has reached the 999-order limit. Please contact an administrator.')
  }

  const sequence = counter.nextSequence
  writeCounter({
    hourKey: counter.hourKey,
    nextSequence: sequence + 1,
  })
  return {
    reference: formatHourlyOrderNumber(date, sequence),
    sequence,
  }
}

export function formatCustomerOrderNumber(value: string) {
  const cleaned = value.trim().replace(/^#/, '')
  const hourlyMatch = cleaned.match(/(?:^|-)((?:[01]\d|2[0-3])-\d{3})$/)
  if (hourlyMatch) return hourlyMatch[1]

  const timestampMatch = cleaned.match(/(\d{4})(\d{2})(\d{2})\d{6}-(\d{4,})$/)
  if (timestampMatch) return `${timestampMatch[2]}${timestampMatch[3]}-${timestampMatch[4]}`

  const lastSegment = cleaned.split('-').filter(Boolean).at(-1)
  if (lastSegment && /^\d{4,}$/.test(lastSegment)) return lastSegment
  if (/^\d{1,6}$/.test(cleaned)) return cleaned.padStart(4, '0')

  const digits = cleaned.replace(/\D/g, '')
  if (digits.length >= 5) return digits.slice(-5)
  return cleaned || '----'
}

function readCounter(date: Date): HourlyOrderCounter {
  const hourKey = localHourKey(date)
  if (typeof window === 'undefined') return { hourKey, nextSequence: 1 }

  try {
    const saved = JSON.parse(window.localStorage.getItem(hourlyOrderCounterKey) ?? 'null') as Partial<HourlyOrderCounter> | null
    const nextSequence = Math.max(1, Math.floor(Number(saved?.nextSequence) || 1))
    if (saved?.hourKey === hourKey) return { hourKey, nextSequence }
  } catch {
    // Start a fresh hourly counter when saved browser data is invalid.
  }
  return { hourKey, nextSequence: 1 }
}

function writeCounter(counter: HourlyOrderCounter) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(hourlyOrderCounterKey, JSON.stringify(counter))
}

function localHourKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
    String(date.getHours()).padStart(2, '0'),
  ].join('')
}
