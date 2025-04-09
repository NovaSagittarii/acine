import * as pb from 'acine-proto-dist';
import { toOutCoordinates } from './ui/MouseRegion';

interface WindowProps {
  websocket: WebSocket;
  dimensions: [number, number];
  imageUrl?: string | null;
}

/**
 * Input window similar to MouseRegion (but no region),
 *
 * Automatically forwards mouse move/up/down to websocket (for backend)
 * to implement input passthrough.
 *
 * Also allows listening to a batch of events for recording and playback.
 */
export default function Window({
  websocket: ws,
  dimensions,
  imageUrl = null,
}: WindowProps) {
  return (
    <div
      className='min-h-[12rem] bg-black'
      onMouseMove={(ev) => {
        const { x, y } = toOutCoordinates(...dimensions, ev);
        const inputEvent = pb.InputEvent.create({
          // ev.timeStamp is ms with float values
          // but don't really need sub ms precision so round it off
          timestamp: Math.round(ev.timeStamp),
          type: {
            $case: 'move',
            move: {
              x,
              y,
            },
          },
        });
        const pkt = pb.Packet.create({
          type: {
            $case: 'inputEvent',
            inputEvent,
          },
        });
        ws.send(pb.Packet.encode(pkt).finish());
      }}
      onMouseDown={() => {
        const pkt = pb.Packet.create({
          type: {
            $case: 'inputEvent',
            inputEvent: {
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
            $case: 'inputEvent',
            inputEvent: {
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
  );
}
