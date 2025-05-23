/**
 * nanostores atoms for client state
 */

import { atom } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import {
  FrameOperation,
  FrameOperation_Operation,
  Packet,
  Routine,
  Routine_Node,
  Routine_State,
} from 'acine-proto-dist';
import InputSource from './client/input_source';

export const $routine = atom(Routine.create());
export const $routineBase64 = persistentAtom<string>(
  'rb64',
  JSON.stringify(Routine.toJSON(Routine.create())),
);

function getRb64MiB() {
  return ($routineBase64.get().length / (1 << 20)).toFixed(2);
}

export function saveRoutine() {
  let o = Routine.fromJSON(Routine.toJSON($routine.get()));

  // scrub frame.data (its too big)
  o.frames.map((f) => (f.data = new Uint8Array(0)));

  $routineBase64.set(JSON.stringify(Routine.toJSON(o)));
  console.log(`write ${getRb64MiB()} MiB (in base64) to storage`);
  console.log(o);
}

/**
 * Loads the base routine from localStorage (persistent-nanostores) and then
 * batch requests the frames from backend.
 * @param ws websocket to backend
 */
export function loadRoutine(ws: WebSocket) {
  let r = Routine.fromJSON(JSON.parse($routineBase64.get()!));

  // TODO: a part of the stuff that should be moved
  // into the client connection class
  const f = FrameOperation.create();
  f.frames = r.frames;
  f.type = FrameOperation_Operation.OPERATION_BATCH_GET;
  const pkt = Packet.create({
    type: {
      $case: 'frameOperation',
      frameOperation: f,
    },
  });
  ws.send(Packet.encode(pkt).finish());

  $routine.set(r);
  // $frames.set(fr.frames.map(frameToObjectURL));
  // can't set since dependent on server now...
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

/**
 * reference to currently selected node
 *
 * need `$routine.set($routine.get())` to make changes appear
 */
export const $selectedNode = atom<Routine_Node | null>(null);

/**
 * a global input source, this is used for
 *
 * forwarding replay events => client websocket => backend
 */
export const $replayInputSource = atom<InputSource>(new InputSource());
