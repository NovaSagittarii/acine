/**
 * used for various type conversions
 */

import { Frame } from 'acine-proto-dist';

export function frameToObjectURL(frame: Frame) {
  const frameData = frame.data;
  if (!frameData) throw new Error('missing frame.data');
  const blob = new Blob([frameData]);
  const imageUrl = URL.createObjectURL(blob);
  return imageUrl;
}
