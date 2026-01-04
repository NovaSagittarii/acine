import { InputReplay, Routine_Condition, Routine_Edge } from 'acine-proto-dist';
import { useEffect, useMemo, useState } from 'react';
import { useStore } from '@nanostores/react';
import { replayInputSource } from '@/state';

import Button from './ui/Button';
import { open } from '../client/input_stream';
import { acquireOffset, runtimeSetCurr } from '../App.state';
import Checkbox from './ui/Checkbox';
import { $currentEdge } from './Edge.state';

interface ReplayEditorProps {
  replay: InputReplay;
  condition?: Routine_Condition; // for offset calculation if relative replay
  edge?: Routine_Edge;
}
export default function ReplayEditor({
  condition,
  replay,
  edge,
}: ReplayEditorProps) {
  const [isRecording, setRecording] = useState<boolean>(false);
  const [isPlaying, setPlaying] = useState<boolean>(false); // for replay
  const [stream, setStream] = useState<null | ReturnType<typeof open>>(null);
  const currentEdge = useStore($currentEdge);

  const [offset, setOffset] =
    useState<Awaited<ReturnType<typeof acquireOffset>>>(undefined);

  // close stream if it is closed without stopping
  useEffect(() => {
    if (stream && isRecording) {
      return () => {
        setTimeout(() => {
          stream.close();
        }, 1000);
      };
    }
  }, [stream, isRecording]);
  const active = useMemo(
    () => currentEdge?.precondition === condition,
    [currentEdge, condition],
  );
  const [progress, setProgress] = useState(-1);
  useEffect(() => {
    if (isPlaying) {
      const interval = setInterval(
        () => setProgress(replayInputSource.progress()),
        16,
      );
      return () => clearInterval(interval);
    } else setProgress(0);
    return () => {};
  }, [isPlaying]);

  return (
    <div className={`flex flex-col ${active && 'bg-blue-100 drop-shadow-sm'}`}>
      <div className='flex flex-row justify-evenly'>
        <div className='flex flex-row'>
          {replay.duration} <div className='opacity-50'>ms: duration</div>
        </div>
        <div className='flex flex-row'>
          {replay.events.length} <div className='opacity-50'>: events</div>
        </div>
        <div className='flex flex-row'>
          <Checkbox
            value={replay.relative}
            onChange={(newValue) => (replay.relative = newValue)}
          />
          <div className='opacity-50'>: relative</div>
        </div>
      </div>
      <div className='relative py-2 px-4 flex flex-row gap-4 font-sans'>
        <div
          className='absolute bottom-0 left-0 h-1 bg-blue-500'
          style={{ width: Math.max(0, progress * 100) + '%' }}
        />
        {!isRecording ? (
          <>
            <Button
              key='record'
              className='p-1! w-full bg-black text-white'
              shortcut={active && 'KeyR'}
              onClick={async () => {
                if (condition) setOffset(await acquireOffset(condition));
                setRecording(true);
                setStream(open());
              }}
            >
              Record
            </Button>
            {!isPlaying ? (
              <Button
                key='playback'
                className='p-1! w-full bg-black text-white'
                shortcut={active && 'KeyP'}
                onClick={async ({ shiftKey }) => {
                  let dx, dy;
                  if (condition && replay.relative && replay.offset) {
                    const offset = await acquireOffset(condition);
                    if (offset) {
                      const { x, y } = offset; // current
                      const { x: px, y: py } = replay.offset; // old
                      dx = x - px;
                      dy = y - py;
                      console.log({ x, y }, { px, py }, { dx, dy });
                    }
                  }
                  replayInputSource.setEndCallback(() => {
                    setPlaying(false);
                    if (shiftKey && edge && edge.to) runtimeSetCurr(edge.to);
                  });
                  setPlaying(true); // it's possible endCallback is immediate
                  replayInputSource.play(replay, dx, dy);
                }}
              >
                Playback
              </Button>
            ) : (
              <Button
                key='stop playback'
                className='p-1! w-full bg-red-500 text-white'
                shortcut={active && 'KeyP'}
                onClick={() => replayInputSource.stop()}
              >
                Stop
              </Button>
            )}
            {/* <Button
              className='p-1! w-full bg-black text-white'
              onClick={() => console.log(replay)}
            >
              console.log
            </Button> */}
          </>
        ) : (
          <>
            <Button
              key='cancel record'
              className='p-1! w-full bg-red-500 text-white'
              shortcut='Escape'
              onClick={() => {
                setRecording(false);
                if (stream) {
                  stream.close();
                }
              }}
            >
              Cancel
            </Button>
            <Button
              key='save recording'
              className='p-1! w-full bg-black text-white'
              shortcut='Enter'
              onClick={async ({ shiftKey }) => {
                setRecording(false);
                if (stream) {
                  stream.close({ noHover: true });
                  await stream.writeTo(replay);
                  if (offset && offset.x && offset.y) {
                    replay.offset = {
                      x: offset.x,
                      y: offset.y,
                      width: 0, // TODO: relativepoint
                      height: 0,
                    };
                  }
                  console.log(replay.events);
                  if (shiftKey && edge && edge.to) runtimeSetCurr(edge.to);
                } else console.error("InputStream wasn't initialized.");
              }}
            >
              Save Recording
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
