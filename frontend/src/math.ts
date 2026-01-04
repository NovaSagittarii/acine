export function constrain(x: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, x));
}

export function average(a: Array<number>): number {
  if (a.length === 0) return 0;
  return a.reduce((a, c) => a + c) / a.length;
}
