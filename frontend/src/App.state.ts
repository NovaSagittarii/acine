import * as pb from 'acine-proto-dist';

import {
  $frames,
  $routine,
  $sourceDimensions as dimensions,
  loadRoutine,
  saveRoutine, // used in global scope
  $runtimeContext,
} from './state';
import { frameToObjectURL } from './client/encoder';

/** callbacks for specific id's */
const wsListeners: Record<number, (arg0: pb.Packet) => void> = {};

export const ws = new WebSocket('ws://localhost:9000');
ws.onopen = () => {
  console.log('ws open');
  const req = pb.Packet.create({
    type: {
      $case: 'configuration',
      configuration: {},
    },
  });
  ws.send(pb.Packet.encode(req).finish());
  // autoload on connect (nice QoL)
  if ($frames.get().length === 0) {
    // but only when no frames exist (don't repeatedly fire on hot reload)
    // ... doesn't seem to work properly ($frames cleared on hot reload)
    loadRoutine(ws);
  }
};
ws.onclose = () => console.log('ws close');
ws.onmessage = async (data) => {
  const packet = pb.Packet.decode(
    new Uint8Array(await data.data.arrayBuffer()),
  );
  switch (packet.type?.$case) {
    case 'configuration': {
      const conf = packet.type.configuration;
      dimensions.set([conf.width, conf.height]);
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
    case 'getRoutine': {
      const { getRoutine: routine } = packet.type;
      console.log('rcv', routine);
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
    case 'sampleCondition': {
      const cb = wsListeners[packet.id];
      if (cb) cb(packet);
      break;
    }
    // TODO: setStack
    default:
      console.warn('Unhandled packet', packet);
  }
};

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
 */
export async function runtimeConditionQuery(condition: pb.Routine_Condition) {
  return new Promise<pb.ConditionProcessing_Frame[]>((resolve) => {
    const id = Math.floor(Math.random() * -(1 << 31));
    wsListeners[id] = (packet: pb.Packet) => {
      if (packet.type?.$case === 'sampleCondition') {
        resolve(packet.type.sampleCondition.frames);
        delete wsListeners[id];
      } else {
        console.warn(`unexpected response for id ${id}`, packet);
      }
    };
    const packet = pb.Packet.create({
      id,
      type: {
        $case: 'sampleCondition',
        sampleCondition: {
          condition,
        },
      },
    });
    ws.send(pb.Packet.encode(packet).finish());
  });
}
