export function money(value: { toString(): string } | number | null | undefined) {
  if (value == null) {
    return 0;
  }
  return Number(value);
}

export function startOfDay(date = new Date()) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}
