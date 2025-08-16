/**
 * nanostores atoms for client state
 */

import { atom } from 'nanostores';
import { persistentAtom } from '@nanostores/persistent';
import {
  BackendConfiguration,
  ConditionProcessing_Frame,
  FrameOperation,
  FrameOperation_Operation,
  Packet,
  Point,
  Routine,
  Routine_Condition_Image,
  Routine_Node,
  Routine_State,
  RuntimeState,
} from 'acine-proto-dist';
import InputSource from './client/input_source';

export const $backendConfiguration = atom(BackendConfiguration.create());

/**
 * if null, no routine has been selected yet
 * TODO: some day merge with $routine ? (use useContext or propagate routine dependency ?)
 */
export const $loadedRoutine = atom<Routine | null>(null);

/**
 * routine being edited (most code references this and assumes it exists)
 * TEMPORARY WORKAROUND: use $loadedRoutine to check if it exists or not instead.
 */
export const $routine = atom<Routine>(Routine.create());

export const $routineBase64 = persistentAtom<string>(
  'rb64',
  JSON.stringify(Routine.toJSON(Routine.create())),
);

function getRb64MiB() {
  return ($routineBase64.get().length / (1 << 20)).toFixed(2);
}

export function saveRoutine() {
  const r = $routine.get();
  if (!r) throw new Error('Cannot save routine when routine is null.');

  const o = Routine.fromJSON(Routine.toJSON(r));

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
  const r = Routine.fromJSON(JSON.parse($routineBase64.get()));

  prepareRoutineFrames(ws, r);

  $routine.set(r);
  // $frames.set(fr.frames.map(frameToObjectURL));
  // can't set since dependent on server now...
  console.log(`loaded ${getRb64MiB()} MiB (in base64)`);
}

/**
 * Batch requests a routine's frames from backend.
 * @param ws websocket connected to backend
 * @param routine routine with frames that need to be loaded
 */
export function prepareRoutineFrames(ws: WebSocket, routine: Routine) {
  // TODO: a part of the stuff that should be moved
  // into the client connection class
  const f = FrameOperation.create();
  f.frames = routine.frames;
  f.type = FrameOperation_Operation.OPERATION_BATCH_GET;
  const pkt = Packet.create({
    type: {
      $case: 'frameOperation',
      frameOperation: f,
    },
  });
  ws.send(Packet.encode(pkt).finish());
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

/**
 * current runtime context, includes current node and return stack
 */
export const $runtimeContext = atom<RuntimeState>(RuntimeState.create());

/**
 * current runtime mouse state, position
 */
export const $runtimeMousePosition = atom<Point>(Point.create());

/**
 * current runtime mouse state, pressed (bitmask)
 */
export const $runtimeMousePressed = atom<number>(0);

interface MatchOverlay {
  preview: ConditionProcessing_Frame[];
  image?: Routine_Condition_Image;
  offset?: Point;
}
/**
 * this match result is displayed over the main window
 */
export const $matchOverlay = atom<MatchOverlay>({ preview: [] });
