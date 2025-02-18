/**
 * nanostores atoms for client state
 */

import { atom } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import { Routine, Routine_State } from 'acine-proto-dist';
import { frameToObjectURL } from './client/encoder';

export const $routine = atom(Routine.create());
export const $routineBase64 = persistentAtom<string>(
  'rb64',
  JSON.stringify(Routine.toJSON(Routine.create())),
);

/**
 * has actual frame objects (doesn't get reloaded like the reload as frequently)
 */
export const $routineFrames = atom(Routine.create());

function getRb64MiB() {
  return ($routineBase64.get().length / (1 << 20)).toFixed(2);
}

export function saveRoutine() {
  let o = Routine.fromJSON(Routine.toJSON($routine.get()));
  o.frames = $routineFrames.get().frames;
  $routineBase64.set(JSON.stringify(Routine.toJSON(o)));
  console.log(`write ${getRb64MiB()} MiB (in base64) to storage`);
}

export function loadRoutine() {
  let r = Routine.fromJSON(JSON.parse($routineBase64.get()!));
  let fr = Routine.create();
  fr.frames = r.frames.splice(0);
  $routine.set(r);
  $routineFrames.set(fr);
  $frames.set(fr.frames.map(frameToObjectURL));
  console.log(`loaded ${getRb64MiB()} MiB (in base64)`);
}

/**
 * frame objectURLs
 */
export const $frames = atom<string[]>([]);

/**
 * reference to currently selected state
 *
 * need `$routine.set($routine.get())` to make changes appear
 */
export const $selectedState = atom<Routine_State | null>(null);

/**
 * [width, height] of the window you are controlling
 */
export const $sourceDimensions = atom<[number, number]>([0, 0]);
