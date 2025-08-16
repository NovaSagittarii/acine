import { useStore } from '@nanostores/react';
import * as pb from 'acine-proto-dist';
import { useCallback, useEffect, useState } from 'react';

import { ws, getFrame, persistFrame } from './App.state';

import {
  $frames,
  $routine,
  $selectedState,
  $sourceDimensions, // used in useStore (function scope)
  loadRoutine,
  saveRoutine, // used in global scope
  $replayInputSource,
  $loadedRoutine,
  $backendConfiguration,
} from './state';
import Button from './components/ui/Button';
import StateList from './components/StateList';
import NodeList from './components/NodeList';
import ConditionImageEditor from './components/ConditionImageEditor';
import Window from './components/Window';
import RoutineViewer from './components/RoutineViewer';

enum ActiveTab {
  STATE,
  NODE,
  GRAPH,
  length, // keep this at the end to know how many tabs there are
}

/**
 * used to save the current frame to persistent storage (sort of)
 * current implementation is keep a persistent objectURL
 * in the future, actually save it (not just as objectURL)
 *
 * this is a callback overridden each time client receives new frame through ws
 */
let saveCurrentFrame = () => -1;

function RoutineEditor() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dState, setDState] = useState(''); // debug state
  const [dSend, setDSend] = useState(0);
  const [dRecv, setDRecv] = useState(0);

  const listen = useCallback(
    async (ev: MessageEvent<Blob>) => {
      // todo: turn this into a EventEmitter
      const { data }: { data: Blob } = ev;

      const packet = pb.Packet.decode(new Uint8Array(await data.arrayBuffer()));
      if (packet.type?.$case === 'frameOperation') {
        const frameOperation = packet.type.frameOperation;
        if (frameOperation.type === pb.FrameOperation_Operation.OPERATION_GET) {
          const { frame } = frameOperation;
          if (!frame) return;
          const { data, state, width, height } = frame;
          $sourceDimensions.set([width, height]);
          setDState(state);
          setDRecv(Date.now() - dSend);
          const blob = new Blob([data as BlobPart]);
          const imageUrl = URL.createObjectURL(blob);
          saveCurrentFrame = () => {
            const routine = $routine.get();
            if (!routine) throw new Error('invalid routine ' + routine);
            const persistentURL = URL.createObjectURL(blob);
            const newId = $frames.get().length;
            $frames.set([...$frames.get(), persistentURL]);
            routine.frames.push(pb.Frame.create({ id: frame.id }));
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
    },
    [dSend],
  );

  useEffect(() => {
    const callback = (e: MessageEvent<Blob>) => void listen(e);
    ws.addEventListener('message', callback);
    return () => {
      ws.removeEventListener('message', callback);
    };
  }, [listen]);

  useEffect(() => {
    const int = setInterval(() => {
      getFrame();
      setDSend(Date.now());
    }, 250);
    return () => {
      clearInterval(int);
    };
  }, []);

  const replayInputSource = useStore($replayInputSource);
  const selectedState = useStore($selectedState);
  const dimensions = useStore($sourceDimensions);
  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.STATE);

  return (
    <>
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
            {/* <div className='flex gap-4'>
              <Button className='bg-blue-200 w-full'>Click</Button>
              <Button className='bg-blue-200 w-full'>Click (Region)</Button>
              <Button className='bg-blue-200 w-full'>Drag</Button>
            </div> */}
            <Window
              websocket={ws}
              replaySource={replayInputSource}
              dimensions={dimensions}
              imageUrl={imageUrl}
            />
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
                className={`hover:bg-amber-100 ${activeTab.valueOf() === index && 'font-bold'}`}
              >
                {['states', 'nodes', 'graph'][index]}
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
              onClick={() => console.info($routine.get())}
            >
              log
            </div>
            <div
              className='hover:bg-amber-100'
              onClick={() => {
                const routine = $routine.get();
                if (!routine) throw new Error('invalid routine ' + routine);
                const pkt = pb.Packet.create({
                  type: {
                    $case: 'routine',
                    routine: routine,
                  },
                });
                console.log(pkt);
                ws.send(pb.Packet.encode(pkt).finish());
              }}
            >
              push
            </div>
            <div
              className='hover:bg-amber-100'
              onClick={() => {
                const pkt = pb.Packet.create({
                  type: { $case: 'getRoutine', getRoutine: {} },
                });
                console.log(pkt);
                ws.send(pb.Packet.encode(pkt).finish());
              }}
            >
              pull
            </div>
          </div>
          {activeTab === ActiveTab.STATE && <StateList />}
          {activeTab === ActiveTab.NODE && <NodeList />}
          {activeTab === ActiveTab.GRAPH && <RoutineViewer />}
        </div>
      </div>
      <ConditionImageEditor />
    </>
  );
}

function RoutineSelector() {
  const config = useStore($backendConfiguration);

  return (
    <div className='flex flex-col p-8 gap-2 overflow-y-auto'>
      Double click to load
      <div
        className='p-4 flex flex-col border border-black hover:bg-amber-100'
        onDoubleClick={() => {
          const packet = pb.Packet.create({
            type: {
              $case: 'createRoutine',
              createRoutine: {
                name: 'Untitled Routine',
                description: 'A newly created unconfigured routine.',
                windowName: 'TestEnv',
              },
            },
          });
          ws.send(pb.Packet.encode(packet).finish());
        }}
      >
        new
      </div>
      {config.routines.map((routine, index) => (
        <div
          key={index}
          className='p-4 flex flex-col border border-black hover:bg-amber-100 rounded-sm'
          onDoubleClick={() => {
            const packet = pb.Packet.create({
              type: {
                $case: 'loadRoutine',
                loadRoutine: routine,
              },
            });
            ws.send(pb.Packet.encode(packet).finish());
          }}
        >
          <div className='text-lg font-semibold'>{routine.name}</div>
          <div className='text-sm'>
            {routine.description || '<no description>'}
          </div>
          <div className='text-xs'>{routine.id}</div>
        </div>
      ))}
    </div>
  );
}

export default function App() {
  const loadedRoutine = useStore($loadedRoutine);
  return (
    <div className='w-screen h-screen'>
      {loadedRoutine ? <RoutineEditor /> : <RoutineSelector />}
    </div>
  );
}
