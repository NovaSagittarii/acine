import { InputReplay } from 'acine-proto-dist';
import { useState } from 'react';
import { useStore } from '@nanostores/react';
import { $replayInputSource } from '@/state';

import Button from './ui/Button';
import { open } from '../client/input_stream';

interface ReplayEditorProps {
  replay: InputReplay;
}
export default function ReplayEditor({ replay }: ReplayEditorProps) {
  const [isRecording, setRecording] = useState<boolean>(false);
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
            <Button
              className='p-1! w-full bg-black text-white'
              onClick={() => replayInputSource.play(replay)}
            >
              Playback
            </Button>
            <Button
              className='p-1! w-full bg-black text-white'
              onClick={() => console.log(replay)}
            >
              console.log
            </Button>
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
