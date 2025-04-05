import { Rect } from 'acine-proto-dist';
import { ReactNode, useState } from 'react';

import { toPercentage } from '../../client/util';

type MouseEventCallback = (
  ev: React.MouseEvent<HTMLDivElement, MouseEvent>,
) => void;

interface MouseRegionProps {
  className?: string;
  disabled?: boolean;
  outWidth: number; // mapped output width
  outHeight: number; // mapped output height
  children: ReactNode;
  onMouseMove?: MouseEventCallback;
  onMouseDown?: MouseEventCallback;
  onMouseUp?: MouseEventCallback;
  onDragRegion?: (region: Rect) => void;
}

/**
 * Maps a MouseEvent relative location within a target (such as a div)
 * to another rectangular region.
 * @param outWidth
 * @param outHeight
 * @param ev
 * @returns
 */
export function toOutCoordinates(
  outWidth: number,
  outHeight: number,
  ev: React.MouseEvent,
) {
  const { left, top, width, height } = (
    ev.target as HTMLDivElement
  ).getBoundingClientRect();
  const { pageX, pageY } = ev;

  // relative to target
  const rx = pageX - left;
  const ry = pageY - top;

  // console.log(rx, ry, width, height, outWidth, outHeight);

  // mapped to output
  const x = Math.floor((rx / width) * outWidth);
  const y = Math.floor((ry / height) * outHeight);

  return { x, y };
}

/**
 * A region that listens for mouse events.
 *
 * Handles standard move/down/up
 *
 * Added support for a rectangular selection on drag.
 */
function MouseRegion({
  className = '',
  disabled = false,
  children,
  outWidth,
  outHeight,
  onMouseMove = (_) => {},
  onMouseDown = (_) => {},
  onMouseUp = (_) => {},
  onDragRegion = () => {},
}: MouseRegionProps) {
  let [xy1, setMouseDownPosition] = useState<ReturnType<
    typeof toOutCoordinates
  > | null>(null);
  let [xy0, setMouseCurrentPosition] = useState<ReturnType<
    typeof toOutCoordinates
  > | null>(null);

  return (
    <div
      className={'relative ' + className}
      onMouseMove={(ev) => {
        if (disabled) return;
        setMouseCurrentPosition(toOutCoordinates(outWidth, outHeight, ev));
        onMouseMove(ev);
      }}
      onMouseDown={(ev) => {
        if (disabled) return;
        setMouseDownPosition(toOutCoordinates(outWidth, outHeight, ev));
        onMouseDown(ev);
      }}
      onMouseUp={(ev) => {
        if (disabled) return;
        setMouseCurrentPosition(null);
        const xy2 = toOutCoordinates(outWidth, outHeight, ev);
        const { x: x1, y: y1 } = xy1!; // down pos
        const { x: x2, y: y2 } = xy2; // up pos
        const region = Rect.create();
        region.left = Math.min(x1, x2);
        region.right = Math.max(x1, x2);
        region.top = Math.min(y1, y2);
        region.bottom = Math.max(y1, y2);
        onDragRegion(region);
        onMouseUp(ev);
        setMouseDownPosition(null);
      }}
    >
      {children}
      {xy0 && xy1 && (
        <div
          className='absolute outline-2 outline-amber-500 pointer-events-none'
          style={{
            left: toPercentage(Math.min(xy0.x, xy1.x) / outWidth),
            top: toPercentage(Math.min(xy0.y, xy1.y) / outHeight),
            width: toPercentage(Math.abs(xy1.x - xy0.x) / outWidth),
            height: toPercentage(Math.abs(xy1.y - xy0.y) / outHeight),
          }}
        ></div>
      )}
    </div>
  );
}

export default MouseRegion;
