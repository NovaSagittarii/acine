import { InputReplay } from 'acine-proto-dist';
import Button from './ui/Button';
import { useState } from 'react';
import { open } from '../client/input_stream';

interface ReplayEditorProps {
  replay: InputReplay;
}
export default function ReplayEditor({ replay }: ReplayEditorProps) {
  const [isRecording, setRecording] = useState<boolean>(false);
  const [stream, setStream] = useState<null | ReturnType<typeof open>>(null);

  return (
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
          <Button className='p-1! w-full bg-black text-white'>Playback</Button>
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
              replay.events = await stream.getContents();
              console.log(replay.events);
            } else console.error("InputStream wasn't initialized.");
          }}
        >
          Stop Recording
        </Button>
      )}
    </div>
  );
}
