import { InputReplay, Routine_Condition } from 'acine-proto-dist';
import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { $replayInputSource, $matchOverlay } from '@/state';

import Button from './ui/Button';
import { open } from '../client/input_stream';
import { runtimeConditionQuery } from '../App.state';

interface ReplayEditorProps {
  replay: InputReplay;
  condition?: Routine_Condition; // for offset calculation if relative replay
}
export default function ReplayEditor({ condition, replay }: ReplayEditorProps) {
  const [isRecording, setRecording] = useState<boolean>(false);
  const [isPlaying, setPlaying] = useState<boolean>(false); // for replay
  const [stream, setStream] = useState<null | ReturnType<typeof open>>(null);
  const replayInputSource = useStore($replayInputSource);

  return (
    <div className='flex flex-col'>
      <div className='flex flex-row justify-evenly'>
        <div className='flex flex-row'>
          {replay.duration} <div className='opacity-50'>ms: duration</div>
        </div>
        <div className='flex flex-row'>
          {replay.events.length} <div className='opacity-50'>: events</div>
        </div>
      </div>
      <div className='py-2 px-4 flex flex-row gap-4 font-sans'>
        {!isRecording ? (
          <>
            <Button
              className='p-1! w-full bg-black text-white'
              onClick={() => {
                setRecording(true);
                setStream(open());
              }}
            >
              Record
            </Button>
            {condition && (
              <Button
                className='p-1! w-full bg-black text-white'
                onClick={async () => {
                  if (condition.condition?.$case === 'image') {
                    $matchOverlay.set({
                      preview: await runtimeConditionQuery(condition, true),
                      image: condition.condition.image,
                    });
                  }
                }}
              >
                Query precondition
              </Button>
            )}
            {!isPlaying ? (
              <Button
                className='p-1! w-full bg-black text-white'
                onClick={() => {
                  replayInputSource.setEndCallback(() => setPlaying(false));
                  replayInputSource.play(replay);
                  setPlaying(true);
                }}
              >
                Playback
              </Button>
            ) : (
              <div className='w-full'>
                <Button
                  className='p-1! w-full bg-red-500 text-white'
                  onClick={() => replayInputSource.stop()}
                >
                  Stop
                </Button>
              </div>
            )}
            {/* <Button
              className='p-1! w-full bg-black text-white'
              onClick={() => console.log(replay)}
            >
              console.log
            </Button> */}
          </>
        ) : (
          <Button
            className='p-1! w-full bg-red-500 text-white'
            onClick={async () => {
              setRecording(false);
              if (stream) {
                stream.close({ noHover: true });
                await stream.writeTo(replay);
                console.log(replay.events);
              } else console.error("InputStream wasn't initialized.");
            }}
          >
            Stop Recording
          </Button>
        )}
      </div>
    </div>
  );
}
