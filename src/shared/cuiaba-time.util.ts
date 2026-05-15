const CUIABA_TZ = 'America/Cuiaba';
const CUIABA_OFFSET = '-04:00';

function getCuiabaParts(date: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: CUIABA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const map = Object.create(null) as Record<string, string>;
  for (const p of parts) {
    if (p.type !== 'literal') {
      map[p.type] = p.value;
    }
  }

  return map;
}

export function toCuiabaIsoOffset(date = new Date()): string {
  const map = getCuiabaParts(date);
  return `${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}${CUIABA_OFFSET}`;
}

export function nowInCuiabaDate(): Date {
  return new Date(toCuiabaIsoOffset(new Date()));
}

export function parseToCuiabaDate(value?: string | number | Date | null): Date | null {
  if (value === null || value === undefined || value === '') return null;

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (typeof value === 'number') {
    const fromEpoch = new Date(value);
    return Number.isNaN(fromEpoch.getTime()) ? null : fromEpoch;
  }

  const raw = String(value).trim();
  if (!raw) return null;

  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const parsed = new Date(hasTimezone ? normalized : `${normalized}${CUIABA_OFFSET}`);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDateTimeCuiaba(value?: Date | string | null): string {
  if (!value) return '-';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '-';

  return d.toLocaleString('pt-BR', { timeZone: CUIABA_TZ });
}
