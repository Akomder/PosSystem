// Reads timezone from localStorage so Settings can change it without reload.
// Falls back to Asia/Bangkok (UTC+7) — correct for Laos, Thailand, Vietnam.
export function getTimezone() {
  return localStorage.getItem('pos_timezone') || 'Asia/Bangkok'
}

// Keep the named constant for places that import it directly (backwards-compat).
// Using a getter so it stays reactive to localStorage changes.
export const APP_TIME_ZONE = 'Asia/Bangkok'

function getDateParts(date = new Date(), timeZone = getTimezone()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return { year: map.year, month: map.month, day: map.day };
}

function getHourPart(date = new Date(), timeZone = getTimezone()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  return Number(parts.find((part) => part.type === "hour")?.value || 0);
}

export function formatDateKey(date = new Date(), timeZone = getTimezone()) {
  const { year, month, day } = getDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function getCurrentHourInTimeZone(
  date = new Date(),
  timeZone = APP_TIME_ZONE,
) {
  return getHourPart(date, timeZone);
}

export function formatCurrency(amount, currency = "LAK") {
  const n = Number(amount) || 0;
  if (currency === "USD") {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
    }).format(n);
  }
  if (currency === "THB") {
    return (
      "฿\u00A0" +
      new Intl.NumberFormat("th-TH", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(n)
    );
  }
  // Default: LAK ₭
  return (
    "₭\u00A0" +
    new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n)
  );
}

export function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString("en-US", {
    timeZone: getTimezone(),
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString("en-US", {
    timeZone: getTimezone(),
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function formatRelativeTime(isoString) {
  const now = new Date();
  const then = new Date(isoString);
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr${diffHr > 1 ? "s" : ""} ago`;
  return formatDate(isoString);
}

export function getElapsedMinutes(isoString) {
  const now = new Date();
  const then = new Date(isoString);
  return Math.floor((now - then) / 60000);
}

export function getInitials(name) {
  if (!name) return "??";
  return name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function getTodayLabel() {
  return new Date().toLocaleDateString("en-US", {
    timeZone: getTimezone(),
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
