export function sleep(delay: number) {
  return new Promise((res) => setTimeout(res, delay));
}

export function toPercentage(x: number) {
  return x * 100 + '%';
}

export function constrain(x: number, lo: number, hi: number) {
  if (lo > hi) throw `expect lo=${lo} <= hi=${hi}`;
  return Math.min(Math.max(x, lo), hi);
}
