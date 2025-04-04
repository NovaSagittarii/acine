import { useStore } from '@nanostores/react';
import * as pb from 'acine-proto-dist';
import { useEffect, useState } from 'react';

import {
  $frames,
  $routine,
  $selectedState,
  $sourceDimensions, // used in useStore (function scope)
  $sourceDimensions as dimensions,
  loadRoutine,
  saveRoutine, // used in global scope
} from './state';
import Button from './components/ui/Button';
import StateList from './components/StateList';
import { toOutCoordinates } from './components/ui/MouseRegion';
import NodeEditor from './components/NodeEditor';
import { frameToObjectURL } from './client/encoder';

enum ActiveTab {
  STATE,
  NODE,
  length, // keep this at the end to know how many tabs there are
}

const ws = new WebSocket('ws://localhost:9000');
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
  }
};

function getFrame(id: number = -1) {
  const frameOperation = pb.FrameOperation.create();
  frameOperation.type = pb.FrameOperation_Operation.OPERATION_GET;
  if (id >= 0) frameOperation.frame = pb.Frame.create({ id });
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
function persistFrame(frame: pb.Frame) {
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
 * used to save the current frame to persistent storage (sort of)
 * current implementation is keep a persistent objectURL
 * in the future, actually save it (not just as objectURL)
 *
 * this is a callback overridden each time client receives new frame through ws
 */
let saveCurrentFrame = () => -1;

function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dState, setDState] = useState(''); // debug state
  let dSend = 0;
  const [dRecv, setDRecv] = useState(0);

  const listen = async (ev: MessageEvent) => {
    // todo: turn this into a EventEmitter
    const { data }: { data: Blob } = ev;

    const packet = pb.Packet.decode(new Uint8Array(await data.arrayBuffer()));
    if (packet.type?.$case === 'frameOperation') {
      const frameOperation = packet.type.frameOperation;
      if (frameOperation.type === pb.FrameOperation_Operation.OPERATION_GET) {
        const { frame } = frameOperation;
        if (!frame) return;
        const { data, state } = frame;
        setDState(state);
        setDRecv(Date.now() - dSend);
        const blob = new Blob([data!]);
        const imageUrl = URL.createObjectURL(blob);
        saveCurrentFrame = () => {
          const persistentURL = URL.createObjectURL(blob);
          let newId = $frames.get().length;
          $frames.set([...$frames.get(), persistentURL]);
          $routine.get().frames.push(pb.Frame.create({ id: frame.id }));
          persistFrame(frame);
          return newId;
        };
        setImageUrl((prev) => {
          // revoke old url if it exists
          if (prev) URL.revokeObjectURL(prev);
          return imageUrl;
        });
        // console.log(blob, imageUrl);
      }
    }
  };

  useEffect(() => {
    ws.addEventListener('message', listen);
    return () => {
      ws.removeEventListener('message', listen);
    };
  }, []);

  useEffect(() => {
    const int = setInterval(() => {
      getFrame();
      dSend = Date.now();
    }, 250);
    return () => {
      clearInterval(int);
    };
  }, []);

  const selectedState = useStore($selectedState);
  const dimensions = useStore($sourceDimensions);
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.STATE);

  return (
    <div className='w-screen h-screen'>
      <div className='w-full h-full flex gap-0 rounded-sm'>
        <div className='w-full'>
          <div className='h-full p-4 flex flex-col gap-4'>
            <Button
              className='bg-red-400'
              onClick={() => {
                const frameId = saveCurrentFrame();
                if (frameId < 0) {
                  console.warn('tried to capture nonexistant frame');
                  return;
                }
                selectedState?.samples.push(frameId);
                $routine.set($routine.get());
              }}
            >
              CAPTURE
            </Button>
            <div className='flex gap-4'>
              <Button className='bg-blue-200 w-full'>Click</Button>
              <Button className='bg-blue-200 w-full'>Click (Region)</Button>
              <Button className='bg-blue-200 w-full'>Drag</Button>
            </div>
            <div
              className='min-h-[12rem] bg-black'
              onMouseMove={(ev) => {
                const { x, y } = toOutCoordinates(...dimensions, ev);
                const pkt = pb.Packet.create({
                  type: {
                    $case: 'mouseEvent',
                    mouseEvent: {
                      type: {
                        $case: 'move',
                        move: {
                          x,
                          y,
                        },
                      },
                    },
                  },
                });
                ws.send(pb.Packet.encode(pkt).finish());
              }}
              onMouseDown={() => {
                const pkt = pb.Packet.create({
                  type: {
                    $case: 'mouseEvent',
                    mouseEvent: {
                      type: {
                        $case: 'mouseDown',
                        mouseDown: 0,
                      },
                    },
                  },
                });
                ws.send(pb.Packet.encode(pkt).finish());
              }}
              onMouseUp={() => {
                const pkt = pb.Packet.create({
                  type: {
                    $case: 'mouseEvent',
                    mouseEvent: {
                      type: {
                        $case: 'mouseUp',
                        mouseUp: 0,
                      },
                    },
                  },
                });
                ws.send(pb.Packet.encode(pkt).finish());
              }}
            >
              {imageUrl && (
                <img
                  src={imageUrl}
                  draggable={false}
                  className='w-full object-cover'
                  style={{ imageRendering: 'pixelated' }}
                />
              )}
            </div>
            {dState}
            {`; latency=${(dRecv / 1e3).toFixed(3)}s`}
            {`; ${(1e3 / dRecv).toFixed(1)}fps`}
          </div>
        </div>
        <div className='w-2/3 h-full flex flex-col'>
          <div className='w-full flex flex-row gap-2'>
            {new Array(ActiveTab.length).fill(0).map((_, index) => (
              <div
                key={index}
                onClick={() => setActiveTab(index)}
                className={`hover:bg-amber-100 ${activeTab === index && 'font-bold'}`}
              >
                {['states', 'nodes'][index]}
              </div>
            ))}
            <div className='hover:bg-amber-100' onClick={saveRoutine}>
              save
            </div>
            <div className='hover:bg-amber-100' onClick={() => loadRoutine(ws)}>
              load
            </div>
            <div
              className='hover:bg-amber-100'
              onClick={() => {
                const pkt = pb.Packet.create({
                  type: {
                    $case: 'routine',
                    routine: $routine.get(),
                  },
                });
                console.log(pkt);
                ws.send(pb.Packet.encode(pkt).finish());
              }}
            >
              sync server
            </div>
          </div>
          {activeTab === ActiveTab.STATE && <StateList />}
          {activeTab === ActiveTab.NODE && <NodeEditor />}
        </div>
      </div>
    </div>
  );
}

export default App;
