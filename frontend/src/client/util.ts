export function sleep(delay: number) {
  return new Promise((res) => setTimeout(res, delay));
}

/**
 * converts a float in [0.0, 1.0] to a percentage [0%, 100%]
 */
export function toPercentage(x: number) {
  return x * 100 + '%';
}

export function constrain(x: number, lo: number, hi: number) {
  if (lo > hi) throw `expect lo=${lo} <= hi=${hi}`;
  return Math.min(Math.max(x, lo), hi);
}

/**
 * formats a quantity with unit, where unit has plural form
 *
 * if plural form is omitted, just appends `s` to the end of singular form
 */
export function pluralize(
  amt: number,
  singular: string,
  plural: string = singular + 's',
) {
  return `${amt} ${amt === 1 ? singular : plural}`;
}
