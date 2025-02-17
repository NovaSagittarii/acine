import { useEffect, useState } from 'react';
import Button from './components/Button';
import * as pb from 'acine-proto-dist';

const dimensions = [0, 0];
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
};
ws.onclose = () => console.log('ws close');
ws.onmessage = async (data) => {
  const packet = pb.Packet.decode(
    new Uint8Array(await data.data.arrayBuffer()),
  );
  if (packet.type?.$case === 'configuration') {
    const conf = packet.type.configuration;
    dimensions[0] = conf.width;
    dimensions[1] = conf.height;
    console.log('set dimensions', dimensions);
  }
};

function getFrame() {
  const frameOperation = pb.FrameOperation.create();
  frameOperation.type = pb.FrameOperation_Operation.FRAME_OP_GET;
  const packet = pb.Packet.create({
    type: {
      $case: 'frameOperation',
      frameOperation,
    },
  });
  ws.send(pb.Packet.encode(packet).finish());
}

function App() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  async function listen(ev: MessageEvent) {
    // todo: turn this into a EventEmitter
    const { data }: { data: Blob } = ev;

    const packet = pb.Packet.decode(new Uint8Array(await data.arrayBuffer()));
    if (packet.type?.$case === 'frameOperation') {
      const frameOperation = packet.type.frameOperation;
      if (frameOperation.type === pb.FrameOperation_Operation.FRAME_OP_GET) {
        const frameData = frameOperation.frame?.data;
        const blob = new Blob([frameData!]);
        const imageUrl = URL.createObjectURL(blob);
        setImageUrl((prev) => {
          // revoke old url if it exists
          if (prev) URL.revokeObjectURL(prev);
          return imageUrl;
        });
        // console.log(blob, imageUrl);
      }
    }
  }

  useEffect(() => {
    ws.addEventListener('message', listen);
    return () => {
      ws.removeEventListener('message', listen);
    };
  }, []);

  useEffect(() => {
    const int = setInterval(getFrame, 250);
    return () => {
      clearInterval(int);
    };
  }, []);

  return (
    <div className='w-screen h-screen p-8'>
      <div className='w-full h-full flex gap-4 rounded-sm border border-black/10'>
        <div className='w-full'>
          <div className='h-full p-8 flex flex-col gap-4'>
            <Button className='bg-red-400'>CAPTURE</Button>
            <div className='flex gap-4'>
              <Button className='bg-blue-200 w-full'>Click</Button>
              <Button className='bg-blue-200 w-full'>Click (Region)</Button>
              <Button className='bg-blue-200 w-full'>Drag</Button>
            </div>
            <div
              className='min-h-[12rem] bg-black'
              onMouseMove={(ev) => {
                const { offsetLeft, offsetTop, offsetWidth, offsetHeight } =
                  ev.target as HTMLDivElement;
                const { pageX, pageY } = ev;
                const x = pageX - offsetLeft;
                const y = pageY - offsetTop;
                const px = Math.floor((x / offsetWidth) * dimensions[0]);
                const py = Math.floor((y / offsetHeight) * dimensions[1]);
                const pkt = pb.Packet.create({
                  type: {
                    $case: 'mouseEvent',
                    mouseEvent: {
                      type: {
                        $case: 'move',
                        move: {
                          x: px,
                          y: py,
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
              {imageUrl && <img src={imageUrl} draggable={false} />}
            </div>
          </div>
        </div>
        <div className='w-2/3 p-8 flex flex-col gap-4'>
          <div className='h-full overflow-y-auto'>
            <>state</>
          </div>
          <Button className='bg-black text-white'>Add State</Button>
        </div>
      </div>
    </div>
  );
}

export default App;
