import { useEffect, useState } from 'react';
import * as pb from 'acine-proto-dist';

import { toOutCoordinates } from './ui/MouseRegion';
import { handleInputEvent } from '../client/input_stream';
import InputSource from '../client/input_source';

interface WindowProps {
  websocket: WebSocket; // forward events towards here
  replaySource: InputSource; // external replay events from here
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
  replaySource,
  dimensions,
  imageUrl = null,
}: WindowProps) {
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isMouseDown, setMouseDown] = useState(false);
  /**
   * for each event:
   * 1. update mouseX/mouseY/mouseDown (for display)
   * 2. send to websocket
   */
  const processEvent = (event: pb.InputEvent) => {
    // 1. update display values
    switch (event.type?.$case) {
      case 'move':
        const { x, y } = event.type.move;
        setMouseX(x);
        setMouseY(y);
        break;
      case 'mouseDown':
        setMouseDown(true);
        break;
      case 'mouseUp':
        setMouseDown(false);
        break;
    }

    // 2. prepare and send to websocket
    const pkt = pb.Packet.create({
      type: {
        $case: 'inputEvent',
        inputEvent: event,
      },
    });
    ws.send(pb.Packet.encode(pkt).finish());
  };
  useEffect(() => {
    replaySource.setCallback(processEvent);
  }, []);

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
            move: { x, y },
          },
        });
        handleInputEvent(inputEvent);
        processEvent(inputEvent);
      }}
      onMouseDown={(ev) => {
        const inputEvent = pb.InputEvent.create({
          timestamp: Math.round(ev.timeStamp),
          type: {
            $case: 'mouseDown',
            mouseDown: pb.InputEvent_MouseButton.MOUSE_BUTTON_LEFT,
          },
        });
        handleInputEvent(inputEvent);
        processEvent(inputEvent);
      }}
      onMouseUp={(ev) => {
        const inputEvent = pb.InputEvent.create({
          timestamp: Math.round(ev.timeStamp),
          type: {
            $case: 'mouseUp',
            mouseUp: pb.InputEvent_MouseButton.MOUSE_BUTTON_LEFT,
          },
        });
        handleInputEvent(inputEvent);
        processEvent(inputEvent);
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
      <div className='absolute pointer-events-none'>
        ({mouseX}, {mouseY}, {isMouseDown ? 'down' : 'up'})
      </div>
    </div>
  );
}
