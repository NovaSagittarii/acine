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

/**
 * Maps a MouseEvent relative location within a target (such as a div)
 * to another rectangular region.
 * @param outWidth
 * @param outHeight
 * @param ev
 * @returns
 */
export function toOutCoordinates(
  outWidth: number,
  outHeight: number,
  ev: React.MouseEvent,
) {
  const { left, top, width, height } = (
    ev.target as HTMLDivElement
  ).getBoundingClientRect();
  const { pageX, pageY } = ev;

  // relative to target
  const rx = pageX - left;
  const ry = pageY - top;

  // console.log(rx, ry, width, height, outWidth, outHeight);
  // mapped to output
  const x = Math.floor((rx / width) * outWidth);
  const y = Math.floor((ry / height) * outHeight);

  return { x, y };
}
