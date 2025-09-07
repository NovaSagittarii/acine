import { useCallback, useEffect, useState } from 'react';
import * as pb from 'acine-proto-dist';

import { handleInputEvent } from '../client/input_stream';
import InputSource from '../client/input_source';
import { toOutCoordinates, toPercentage } from '../client/util';
import { useStore } from '@nanostores/react';
import {
  $runtimeMousePosition,
  $runtimeMousePressed,
  $matchOverlay,
} from '@/state';
import ConditionOverlay from './ConditionOverlay';

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
  const matchOverlay = useStore($matchOverlay);

  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isMouseDown, setMouseDown] = useState(false);
  /**
   * for each event:
   * 1. update mouseX/mouseY/mouseDown (for display)
   * 2. send to websocket
   */
  const processEvent = useCallback(
    (event: pb.InputEvent, dx: number = 0, dy: number = 0) => {
      event = pb.InputEvent.create(event); // copy by reference

      // 1. update display values
      switch (event.type?.$case) {
        case 'move': {
          // changes need to apply when inputEvent is sent
          event.type.move.x += dx;
          event.type.move.y += dy;
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
      className='relative h-fit w-fit bg-black'
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
          className='w-fit h-fit object-cover'
          style={{ imageRendering: 'pixelated' }}
        />
      )}
      {matchOverlay.image && (
        <ConditionOverlay
          preview={matchOverlay.preview}
          threshold={matchOverlay.image.threshold}
          templateRegions={matchOverlay.image.regions}
          width={dimensions[0]}
          height={dimensions[1]}
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
        outerUp='border-blue-400'
        outerDown='border-blue-300/40'
        innerDown='border-blue-400/80'
      />
      <div className='absolute bottom-0 right-0 font-mono pointer-events-none bg-white/50 opacity-50'>
        {mouseX.toString().padStart(4, '0')},
        {mouseY.toString().padStart(4, '0')} {isMouseDown ? 'down' : 'up  '}
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
  outerUp?: string; // apply style to outer when mouseUp
  outerDown?: string; // apply style to outer when mouseDown
  innerUp?: string; // apply style to inner when mouseUp
  innerDown?: string; // apply style to inner when mouseDown
}

/**
 * draws pointer (with mousedown animation) over a div
 */
function Pointer({
  x,
  y,
  width,
  height,
  mousePressed,
  outerUp = 'border-amber-600',
  outerDown = 'border-amber-500/40',
  innerUp = 'border-transparent',
  innerDown = 'border-amber-700/80',
}: PointerProps) {
  return (
    <div
      className='absolute top-0 left-0 select-none pointer-events-none'
      // requires pointer-events-none to prevent moving the pointer off the
      // parent screen (since this is a child of the parent element)
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
          `${!mousePressed ? outerUp : 'w-4 h-4 ' + outerDown}`
        }
      >
        <div
          className={
            'w-1 h-1 rounded-full border-4 ' +
            `${!mousePressed ? innerUp : innerDown}`
          }
        ></div>
      </div>
    </div>
  );
}
