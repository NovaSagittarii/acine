import * as pb from 'acine-proto-dist';

import {
  $frames,
  $routine,
  $sourceDimensions as dimensions,
  loadRoutine,
  saveRoutine, // used in global scope
  $runtimeContext,
  $runtimeMousePosition as $mousePosition,
  $runtimeMousePressed as $mousePressed,
  $matchOverlay,
  $backendConfiguration,
  $loadedRoutine,
} from './state';
import { frameToObjectURL } from './client/encoder';

/** callbacks for specific id's */
const wsListeners: Record<number, (arg0: pb.Packet) => void> = {};

const wsUrl = document.location.origin
  .replace('http', 'ws')
  .replace(/(:\d+)?$/, ':9000');
export const ws = new WebSocket(wsUrl);
ws.onopen = () => {
  console.log('ws open');
  const req = pb.Packet.create({
    type: {
      $case: 'getConfiguration',
      getConfiguration: {},
    },
  });
  ws.send(pb.Packet.encode(req).finish());
  // // autoload on connect (nice QoL)
  // if ($frames.get().length === 0) {
  //   // but only when no frames exist (don't repeatedly fire on hot reload)
  //   // ... doesn't seem to work properly ($frames cleared on hot reload)
  //   // ^ is that true still??
  //   loadRoutine(ws);
  // }
};
ws.onclose = () => console.log('ws close');
ws.onmessage = async (data: MessageEvent<Blob>) => {
  const packet = pb.Packet.decode(
    new Uint8Array(await data.data.arrayBuffer()),
  );
  switch (packet.type?.$case) {
    case 'getConfiguration': {
      $backendConfiguration.set(packet.type.getConfiguration);
      break;
    }
    case 'configuration': {
      console.warn('deprecated packet `configuration`', packet);
      const conf = packet.type.configuration;
      if (
        dimensions.get()[0] != conf.width ||
        dimensions.get()[1] != conf.height
      ) {
        dimensions.set([conf.width, conf.height]);
      }

      console.log('set dimensions', dimensions.get());
      break;
    }
    case 'frameOperation': {
      const { frameOperation } = packet.type;
      switch (frameOperation.type) {
        case pb.FrameOperation_Operation.OPERATION_BATCH_GET: {
          // an HTTP server would not have been a bad idea...
          $frames.set(frameOperation.frames.map(frameToObjectURL));
          break;
        }
      }
      break;
    }
    case 'inputEvent': {
      const { inputEvent } = packet.type;
      const { type: ie } = inputEvent;
      switch (ie?.$case) {
        case 'move':
          $mousePosition.set(ie.move);
          break;
        case 'mouseDown':
          $mousePressed.set($mousePressed.get() | ie.mouseDown.valueOf());
          break;
        case 'mouseUp':
          $mousePressed.set($mousePressed.get() & ~ie.mouseUp.valueOf());
          break;
      }
      break;
    }
    case 'getRoutine': {
      const { getRoutine: routine } = packet.type;
      console.log('rcv', routine);
      if (!$loadedRoutine.get()) {
        $loadedRoutine.set(routine);
        // mark as exists
      }
      $routine.set(routine); // set internal routine
      saveRoutine(); // this saves it in b64 persistent
      loadRoutine(ws); // loads from base64 persistent
      break;
    }
    case 'setCurr': {
      const { setCurr: context } = packet.type;
      const c = $runtimeContext.get();
      if (context.currentNode) c.currentNode = context.currentNode;
      c.currentEdge = context.currentEdge; // if null, no longer processing edge
      $runtimeContext.set(c);
      break;
    }
    case 'setStack': {
      const { setStack: context } = packet.type;
      const c = $runtimeContext.get();
      if (context.stackNodes) c.stackNodes = context.stackNodes;
      $runtimeContext.set(c);
      break;
    }
    case 'sampleCondition':
    case 'sampleCurrent': {
      const cb = wsListeners[packet.id];
      if (cb) cb(packet);
      break;
    }
    default:
      console.warn('Unhandled packet', packet);
  }
};

/**
 * - (if `!id`) request the current frame
 * - (if `id`) request a specific frame
 */
export function getFrame(id: string = '') {
  const frameOperation = pb.FrameOperation.create();
  frameOperation.type = pb.FrameOperation_Operation.OPERATION_GET;
  if (id) frameOperation.frame = pb.Frame.create({ id });
  const packet = pb.Packet.create({
    type: {
      $case: 'frameOperation',
      frameOperation,
    },
  });
  ws.send(pb.Packet.encode(packet).finish());
}

/**
 * save a frame on backend (disk)
 */
export function persistFrame(frame: pb.Frame) {
  const frameOperation = pb.FrameOperation.create();
  frameOperation.frame = frame;
  frameOperation.type = pb.FrameOperation_Operation.OPERATION_SAVE;
  const packet = pb.Packet.create({
    type: {
      $case: 'frameOperation',
      frameOperation,
    },
  });
  ws.send(pb.Packet.encode(packet).finish());
}

/**
 * Route the runtime to goto this particular node. If doesn't exist,
 * nothing happens. (no feedback)
 * @param id target node id
 */
export function runtimeGoto(id: string) {
  const packet = pb.Packet.create({
    type: {
      $case: 'goto',
      goto: {
        currentNode: {
          id,
        },
      },
    },
  });
  ws.send(pb.Packet.encode(packet).finish());
}

/**
 * Route the runtime to run this particular edge. If doesn't exist,
 * nothing happens. (no feedback)
 * @param id target edge id
 */
export function runtimeQueueEdge(id: string) {
  const packet = pb.Packet.create({
    type: {
      $case: 'queueEdge',
      queueEdge: {
        currentEdge: {
          id,
        },
      },
    },
  });
  ws.send(pb.Packet.encode(packet).finish());
}

/**
 * Queries backend for candidate matches for a base condition. (budget RPC)
 * @param condition what do u wanna query
 * @param realtime if true, gets the CURRENT frame instead of saved frames
 */
export async function runtimeConditionQuery(
  condition: pb.Routine_Condition,
  realtime: boolean = false,
) {
  return new Promise<pb.ConditionProcessing_Frame[]>((resolve) => {
    const id = Math.floor(Math.random() * -(1 << 31));
    wsListeners[id] = (packet: pb.Packet) => {
      if (packet.type?.$case === 'sampleCondition') {
        resolve(packet.type.sampleCondition.frames);
        delete wsListeners[id];
      } else if (packet.type?.$case === 'sampleCurrent') {
        resolve(packet.type.sampleCurrent.frames);
        delete wsListeners[id];
      } else {
        console.warn(`unexpected response for id ${id}`, packet);
      }
    };
    // looks goofy (instead of lower level nesting like at type) since I was
    // getting typescript errors
    const packet = !realtime
      ? pb.Packet.create({
          id,
          type: {
            $case: 'sampleCondition',
            sampleCondition: { condition },
          },
        })
      : pb.Packet.create({
          id,
          type: {
            $case: 'sampleCurrent',
            sampleCurrent: { condition },
          },
        });
    ws.send(pb.Packet.encode(packet).finish());
  });
}

/**
 * Gets a template match offset
 */
export async function acquireOffset(condition: pb.Routine_Condition) {
  switch (condition.condition?.$case) {
    case 'image': {
      const preview = await runtimeConditionQuery(condition, true);
      const offset = preview[0]?.matches[0]?.position ?? undefined;
      $matchOverlay.set({
        preview,
        image: condition.condition.image,
        offset: offset,
      });
      return offset;
    }
    default:
      console.warn(`unsupported type ${condition.condition?.$case}`, condition);
  }
  return undefined;
}
