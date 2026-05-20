const ITALIAN_LOCALE = "it-IT";
const ROME_TIME_ZONE = "Europe/Rome";

interface FormatDateTimeOptions {
  dateStyle?: Intl.DateTimeFormatOptions["dateStyle"];
  timeStyle?: Intl.DateTimeFormatOptions["timeStyle"];
}

function parseDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateTimeInRome(
  value?: string | null,
  options?: FormatDateTimeOptions,
): string {
  if (!value) {
    return "—";
  }

  const date = parseDate(value);
  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat(ITALIAN_LOCALE, {
    dateStyle: options?.dateStyle ?? "medium",
    timeStyle: options?.timeStyle ?? "short",
    timeZone: ROME_TIME_ZONE,
  }).format(date);
}

export function formatDateInRome(value?: string | null): string {
  if (!value) {
    return "—";
  }

  const date = parseDate(value);
  if (!date) {
    return value;
  }

  return new Intl.DateTimeFormat(ITALIAN_LOCALE, {
    dateStyle: "medium",
    timeZone: ROME_TIME_ZONE,
  }).format(date);
}

export function getRomeLocale() {
  return ITALIAN_LOCALE;
}

export function getRomeTimeZone() {
  return ROME_TIME_ZONE;
}
