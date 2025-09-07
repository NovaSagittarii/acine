import { InputReplay, Routine_Condition } from 'acine-proto-dist';
import { useEffect, useState } from 'react';
import { useStore } from '@nanostores/react';
import { $replayInputSource } from '@/state';

import Button from './ui/Button';
import { open } from '../client/input_stream';
import { acquireOffset } from '../App.state';
import Checkbox from './ui/Checkbox';

interface ReplayEditorProps {
  replay: InputReplay;
  condition?: Routine_Condition; // for offset calculation if relative replay
}
export default function ReplayEditor({ condition, replay }: ReplayEditorProps) {
  const [isRecording, setRecording] = useState<boolean>(false);
  const [isPlaying, setPlaying] = useState<boolean>(false); // for replay
  const [stream, setStream] = useState<null | ReturnType<typeof open>>(null);
  const replayInputSource = useStore($replayInputSource);

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

  return (
    <div className='flex flex-col'>
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
      <div className='py-2 px-4 flex flex-row gap-4 font-sans'>
        {!isRecording ? (
          <>
            <Button
              className='p-1! w-full bg-black text-white'
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
                className='p-1! w-full bg-black text-white'
                onClick={async () => {
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
                  replayInputSource.setEndCallback(() => setPlaying(false));
                  replayInputSource.play(replay, dx, dy);
                  setPlaying(true);
                }}
              >
                Playback
              </Button>
            ) : (
              <Button
                className='p-1! w-full bg-red-500 text-white'
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
              className='p-1! w-full bg-red-500 text-white'
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
              className='p-1! w-full bg-black text-white'
              onClick={async () => {
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
