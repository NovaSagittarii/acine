export function sleep(delay: number) {
  return new Promise((res) => setTimeout(res, delay));
}

export function toPercentage(x: number) {
  return x * 100 + '%';
}
