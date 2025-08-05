import { useCallback, useEffect, useState } from 'react';
import * as pb from 'acine-proto-dist';

import { handleInputEvent } from '../client/input_stream';
import InputSource from '../client/input_source';
import { toOutCoordinates, toPercentage } from '../client/util';
import { useStore } from '@nanostores/react';
import { $runtimeMousePosition, $runtimeMousePressed } from '@/state';

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
  const runtimeMousePosition = useStore($runtimeMousePosition);
  const runtimeMousePressed = useStore($runtimeMousePressed);

  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isMouseDown, setMouseDown] = useState(false);
  /**
   * for each event:
   * 1. update mouseX/mouseY/mouseDown (for display)
   * 2. send to websocket
   */
  const processEvent = useCallback(
    (event: pb.InputEvent) => {
      // 1. update display values
      switch (event.type?.$case) {
        case 'move': {
          const { x, y } = event.type.move;
          setMouseX(x);
          setMouseY(y);
          break;
        }
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
    },
    [ws],
  );
  useEffect(() => {
    replaySource.setCallback(processEvent);
  }, [replaySource, processEvent]);

  return (
    <div
      className='relative min-h-[12rem] bg-black'
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
      <Pointer
        x={mouseX}
        y={mouseY}
        width={dimensions[0]}
        height={dimensions[1]}
        mousePressed={isMouseDown}
      />
      <Pointer
        x={runtimeMousePosition.x}
        y={runtimeMousePosition.y}
        width={dimensions[0]}
        height={dimensions[1]}
        mousePressed={runtimeMousePressed}
      />
      <div className='absolute pointer-events-none'>
        ({mouseX}, {mouseY}, {isMouseDown ? 'down' : 'up'})
      </div>
    </div>
  );
}

interface PointerProps {
  x: number;
  y: number;
  width: number;
  height: number;
  mousePressed: number | boolean;
}

/**
 * draws pointer (with mousedown animation) over a div
 */
function Pointer({ x, y, width, height, mousePressed }: PointerProps) {
  return (
    <div
      className='absolute top-0 left-0 pointer-events-none'
      style={{
        left: toPercentage(x / width),
        top: toPercentage(y / height),
      }}
    >
      <div
        className={
          'bg-transparent w-3 h-3 overflow-hidden rounded-full border-2 ' +
          '-translate-x-[50%] -translate-y-[50%] transition-all ' +
          'flex justify-center items-center ' +
          `${!mousePressed ? 'border-amber-600' : 'scale-125 border-amber-500/30'}`
        }
      >
        <div
          className={
            'w-1 h-1 rounded-full border-4 ' +
            `${!mousePressed ? 'border-transparent' : 'border-amber-700/80'}`
          }
        ></div>
      </div>
    </div>
  );
}
