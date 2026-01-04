import { useStore } from '@nanostores/react';
import * as pb from 'acine-proto-dist';
import { useCallback, useEffect, useMemo, useState } from 'react';

import { ws, getFrame, persistFrame } from './App.state';

import {
  $frames,
  $routine,
  $selectedState,
  $sourceDimensions, // used in useStore (function scope)
  // loadRoutine,
  // saveRoutine, // used in global scope
  replayInputSource,
  $loadedRoutine,
  $backendConfiguration,
  $runtimeContext,
} from './state';
import Button from './components/ui/Button';
import StateList from './components/StateList';
import NodeList from './components/NodeList';
import ConditionImageEditor from './components/ConditionImageEditor';
import Window from './components/Window';
import RoutineViewer from './components/RoutineViewer';
import RoutineConfiguration from './components/RoutineConfiguration';
import { getEdgeDisplay } from './components/Edge.util';
import { increment } from './activity';
import DependencyGraphViewer from './components/scheduler/DependencyGraphViewer';
import ScheduleViewer from './components/scheduler/ScheduleViewer';
import BindingsDisplay from './components/BindingsDisplay';
import { average } from './math';
import { KeyCode } from './components/useShortcut';

enum ActiveTab {
  CONFIG,
  STATE,
  NODE,
  GRAPH, // runtime (navigation graph)
  DGRAPH, // scheduler (dependency graph)
  CRON, // scheduling groups
  length, // keep this at the end to know how many tabs there are
}

/**
 * used to save the current frame to persistent storage (sort of)
 * current implementation is keep a persistent objectURL
 * in the future, actually save it (not just as objectURL)
 *
 * this is a callback overridden each time client receives new frame through ws
 */
let saveCurrentFrame = () => '';

/**
 * Requests server for a copy of the screen, please keep this separate as this
 * gets rerendered about 60 times a second.
 */
function ScreenCopy() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [dState, setDState] = useState(''); // debug state
  const [dSend, setDSend] = useState(0);
  const [latencies, setLatencies] = useState<Array<number>>([]);
  const runtimeContext = useStore($runtimeContext);

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
          setLatencies([...latencies, Date.now() - dSend].splice(-150));
          const blob = new Blob([data as BlobPart]);
          const imageUrl = URL.createObjectURL(blob);
          saveCurrentFrame = () => {
            const routine = $routine.get();
            if (!routine) throw new Error('invalid routine ' + routine); // eslint-disable-line @typescript-eslint/restrict-plus-operands
            const persistentURL = ''; // URL.createObjectURL(blob);
            $frames.set({ ...$frames.get(), [frame.id]: persistentURL });
            routine.frames[frame.id] = pb.Frame.create({ id: frame.id });
            persistFrame(frame);
            return frame.id;
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
    // whenever imageUrl updates, received a new frame so... request another!
    getFrame();
    setDSend(Date.now());
  }, [imageUrl]);

  const averageLatency = useMemo(() => average(latencies), [latencies]);

  const selectedState = useStore($selectedState);
  const dimensions = useStore($sourceDimensions);
  const expanded = false;
  return (
    <div
      className={
        `${expanded ? 'w-full' : 'w-1/3'} max-w-fit transition-all ` +
        'border-r-4 border-blue-500/10 hover:border-blue-500 ' +
        'bg-blue-50 hover:bg-transparent'
      }
    >
      <div className='h-full p-4 flex flex-col gap-4'>
        <Button
          className='bg-red-400'
          shortcut='Backquote'
          onClick={() => {
            const frameId = saveCurrentFrame();
            if (!frameId) {
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
        <div className='font-mono flex-col'>
          <div>
            {dState}
            {` render_latency=${(averageLatency / 1e3).toFixed(3)}s`}
            <div className='absolute top-0 left-0 flex w-[150px] h-[50px] justify-end items-end bg-slate-100 opacity-100 hover:opacity-10 transition-opacity'>
              {latencies.map((x, index) => (
                <div
                  className='w-px'
                  key={index}
                  style={{
                    height: Math.min(x, 50) + 'px',
                    background: `rgb(${Math.min(255, x >= 50 ? x : 0)},0,0)`,
                  }}
                ></div>
              ))}
              <div className='absolute right-0 bottom-0 text-xs font-mono text-white'>
                {` ${(1e3 / averageLatency).toFixed(1)}FPS`}
              </div>
            </div>
          </div>
          <div>
            {runtimeContext?.currentNode?.name}
            {runtimeContext.currentEdge &&
              ' => ' +
                $routine.get().nodes[runtimeContext.currentEdge?.to]?.name}
            {runtimeContext.currentEdge &&
              ' via ' + getEdgeDisplay(runtimeContext.currentEdge)}
            {runtimeContext.targetNode &&
              ' ==> ' + runtimeContext.targetNode.name}
          </div>
        </div>
      </div>
    </div>
  );
}

function RoutineEditor() {
  useEffect(() => {
    // a simple way to handle activity tracking
    let routineId: string | undefined = undefined;
    const unsubscribe = $routine.subscribe((v) => {
      if (v.id) routineId = v.id;
      setTimeout(() => unsubscribe(), 1000);
    });
    const int = setInterval(() => {
      if (routineId && !document.hidden && document.hasFocus()) {
        increment(routineId);
      }
    }, 1000);
    return () => clearInterval(int);
  }, []);

  const [activeTab, setActiveTab] = useState<ActiveTab>(ActiveTab.CONFIG);

  return (
    <>
      <div className='w-full h-full flex gap-0 rounded-sm'>
        <div className='absolute bottom-0 flex flex-col gap-1 items-begin justify-center w-fit p-1 z-50 bg-white opacity-100 hover:opacity-10 transition-opacity'>
          <BindingsDisplay />
        </div>
        <ScreenCopy />
        <div className='w-2/3 h-full flex flex-col grow'>
          <div className='w-full flex flex-row gap-2'>
            {new Array(ActiveTab.length).fill(0).map((_, index) => (
              <Button
                key={index}
                onClick={() => setActiveTab(index)}
                className={`hover:bg-amber-100 ${activeTab.valueOf() === index && 'font-bold'}`}
                variant='minimal'
                shortcut={
                  (['F1', 'F2', 'F3', 'F4', 'F5', 'F6'] as KeyCode[])[index]
                }
              >
                {['config', 'states', 'nodes', 'graph', 'deps', 'cron'][index]}
              </Button>
            ))}
            {/* <div className='hover:bg-amber-100' onClick={saveRoutine}>
              save
            </div>
            <div className='hover:bg-amber-100' onClick={() => loadRoutine(ws)}>
              load
            </div> */}
            <div
              className='hover:bg-amber-100'
              onClick={() => console.info($routine.get())}
            >
              log
            </div>
            <Button
              className='hover:bg-amber-100'
              onClick={() => {
                const routine = $routine.get();
                if (!routine) throw new Error('invalid routine ' + routine); // eslint-disable-line @typescript-eslint/restrict-plus-operands
                const pkt = pb.Packet.create({
                  type: {
                    $case: 'routine',
                    routine: routine,
                  },
                });
                console.log(pkt);
                ws.send(pb.Packet.encode(pkt).finish());
              }}
              variant='minimal'
              shortcut={'F8'}
            >
              push
            </Button>
            <Button
              className='hover:bg-amber-100'
              onClick={() => {
                const pkt = pb.Packet.create({
                  type: { $case: 'getRoutine', getRoutine: {} },
                });
                console.log(pkt);
                ws.send(pb.Packet.encode(pkt).finish());
              }}
              variant='minimal'
              shortcut={'F9'}
            >
              pull
            </Button>
          </div>
          {/* min-h-0 ?? https://stackoverflow.com/a/76670135 */}
          <div className='flex h-full w-full grow min-h-0'>
            {activeTab === ActiveTab.CONFIG && <RoutineConfiguration />}
            {activeTab === ActiveTab.STATE && <StateList />}
            {activeTab === ActiveTab.NODE && <NodeList />}
            {activeTab === ActiveTab.GRAPH && <RoutineViewer />}
            {activeTab === ActiveTab.DGRAPH && <DependencyGraphViewer />}
            {activeTab === ActiveTab.CRON && (
              <ScheduleViewer routine={$routine.get()} />
            )}
          </div>
        </div>
      </div>
      <ConditionImageEditor />
    </>
  );
}

function RoutineSelector() {
  const config = useStore($backendConfiguration);
  const [isBusy, setBusy] = useState(false);

  return (
    <div className='flex flex-col p-8 gap-2 overflow-y-auto'>
      {isBusy ? (
        'Loading... probably (check console and server if it hangs).'
      ) : (
        <>
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
              setBusy(true);
            }}
          >
            Create new
          </div>
          {config.routines.map((routine, index) => (
            <div
              key={index}
              className='p-4 gap-2 flex flex-col border border-black hover:bg-amber-100 rounded-sm'
              onDoubleClick={() => {
                const packet = pb.Packet.create({
                  type: {
                    $case: 'loadRoutine',
                    loadRoutine: routine,
                  },
                });
                ws.send(pb.Packet.encode(packet).finish());
                setBusy(true);
              }}
            >
              <div className='text-lg font-semibold'>{routine.name}</div>
              <div className='text-sm flex flex-col'>
                {routine.description || '<no description>'}
                <div className='flex gap-4'>
                  startup
                  <div className='font-mono'>
                    {routine.startCommand || '<unset>'}
                  </div>
                </div>
                <div className='flex gap-4'>
                  window
                  <div className='font-mono'>
                    {routine.windowName || '<unset>'}
                  </div>
                </div>
              </div>
              <div className='text-xs'>{routine.id}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

export default function App() {
  const loadedRoutine = useStore($loadedRoutine);

  const [isOpen, setOpen] = useState(ws.readyState === WebSocket.OPEN);
  const [isClosed, setClosed] = useState(false);
  useEffect(() => {
    const open = () => setOpen(true);
    const close = () => setClosed(true);
    ws.addEventListener('open', open);
    ws.addEventListener('close', close);
    return () => {
      ws.removeEventListener('open', open);
      ws.removeEventListener('close', close);
    };
  });
  return (
    <div className='w-screen h-screen'>
      <div className='absolute w-full h-full flex justify-center items-center pointer-events-none font-bold text-red-500 text-lg'>
        {!isOpen && isClosed ? ( // closed without opening
          <>
            {'WebSocket connection to <'}
            <div className='font-mono'>{ws.url}</div>
            {'> failed.'}
          </>
        ) : !isOpen ? ( // haven't opened but not closed
          'Connecting to server...'
        ) : (
          isClosed &&
          // opened and closed
          'Disconnected from server.'
        )}
      </div>
      {loadedRoutine ? <RoutineEditor /> : <RoutineSelector />}
    </div>
  );
}
