export function displayRepeatRange(lower: number, upper: number): string {
  if (lower <= 0) return 'never';
  if (lower == upper) {
    if (lower == 1) return 'once';
    if (lower == 2) return 'twice';
    if (lower == 3) return 'thrice';
    return `${lower} times`;
  }
  if (lower > upper) return `at least ${displayRepeatRange(lower, lower)}`;
  if (lower < upper) return `${lower} to ${upper} times`;
  return '0';
}
