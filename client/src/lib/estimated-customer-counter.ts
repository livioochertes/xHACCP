export const ESTIMATED_CUSTOMER_COUNTER_BASE = 3_788;
export const ESTIMATED_CUSTOMER_COUNTER_START_DATE = "2026-10-20";
export const CUSTOMER_COUNTER_TIME_ZONE = "Europe/Paris";
export const CUSTOMER_COUNTER_DAILY_INCREMENT = 10;
export const CUSTOMER_COUNTER_REFRESH_MIN_MS = 30_000;
export const CUSTOMER_COUNTER_REFRESH_MAX_MS = 5 * 60_000;

const BUSINESS_START_MINUTE = 9 * 60;
const BUSINESS_END_MINUTE = 18 * 60;
const UPDATES_PER_DAY = CUSTOMER_COUNTER_DAILY_INCREMENT;
const BUSINESS_WINDOW_MINUTES = BUSINESS_END_MINUTE - BUSINESS_START_MINUTE;

interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
}

function getZonedDateTimeParts(date: Date): ZonedDateTimeParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CUSTOMER_COUNTER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
  };
}

function dayOrdinal(year: number, month: number, day: number): number {
  return Math.floor(Date.UTC(year, month - 1, day) / 86_400_000);
}

function dateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function createSeededRandom(seedText: string): () => number {
  let seed = 0;
  for (const character of seedText) {
    seed = (Math.imul(seed, 31) + character.charCodeAt(0)) >>> 0;
  }

  let state = seed || 1;
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0;
    return state / 2 ** 32;
  };
}

export function getEstimatedCustomerUpdateMinutes(day: string): number[] {
  const random = createSeededRandom(day);
  const slotLength = BUSINESS_WINDOW_MINUTES / UPDATES_PER_DAY;
  const maximumJitter = 15;

  return Array.from({ length: UPDATES_PER_DAY }, (_, index) => {
    const slotCenter = BUSINESS_START_MINUTE + (index + 0.5) * slotLength;
    const jitter = (random() * 2 - 1) * maximumJitter;
    const minute = Math.round(slotCenter + jitter);
    return Math.max(BUSINESS_START_MINUTE, Math.min(BUSINESS_END_MINUTE - 1, minute));
  }).sort((left, right) => left - right);
}

export function getEstimatedCustomerCount(now: Date): number {
  const current = getZonedDateTimeParts(now);
  const [startYear, startMonth, startDay] = ESTIMATED_CUSTOMER_COUNTER_START_DATE
    .split("-")
    .map(Number);
  const daysSinceStart =
    dayOrdinal(current.year, current.month, current.day) -
    dayOrdinal(startYear, startMonth, startDay);

  if (daysSinceStart < 0) return ESTIMATED_CUSTOMER_COUNTER_BASE;

  const today = dateKey(current.year, current.month, current.day);
  const currentMinute = current.hour * 60 + current.minute;
  const incrementsToday = getEstimatedCustomerUpdateMinutes(today)
    .filter((minute) => minute <= currentMinute)
    .length;

  return ESTIMATED_CUSTOMER_COUNTER_BASE
    + daysSinceStart * CUSTOMER_COUNTER_DAILY_INCREMENT
    + incrementsToday;
}

export function getCustomerCounterRefreshDelayMs(random = Math.random): number {
  const range =
    CUSTOMER_COUNTER_REFRESH_MAX_MS - CUSTOMER_COUNTER_REFRESH_MIN_MS + 1;
  return CUSTOMER_COUNTER_REFRESH_MIN_MS + Math.floor(random() * range);
}
