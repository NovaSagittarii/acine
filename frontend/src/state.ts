/**
 * nanostores atoms for client state
 */

import { atom } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import { Routine, Routine_State } from 'acine-proto-dist';

export const $routine = atom(Routine.create());
export const $routineBase64 = persistentAtom('{}');

export function saveRoutine() {
  $routineBase64.set(JSON.stringify(Routine.toJSON($routine.get())));
}

export function loadRoutine() {
  $routine.set(Routine.fromJSON(JSON.parse($routineBase64.get()!)));
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
