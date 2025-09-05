import { atom } from 'nanostores';
import { persistentMap } from '@nanostores/persistent';

const timeSpentMap = persistentMap<Record<string, string>>('time:', {});

export const $timeSpent = atom<number>(-1);

/**
 * increments the counter by one (used for tracking time spent)
 */
export function increment(id: string) {
  const w = (+timeSpentMap.get()[id] || 0) + 1;
  timeSpentMap.setKey(id, '' + w);
  $timeSpent.set(w);
}
