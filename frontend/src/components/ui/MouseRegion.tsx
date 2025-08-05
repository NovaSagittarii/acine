import { Rect } from 'acine-proto-dist';
import { ReactNode, useState } from 'react';

import { toOutCoordinates, toPercentage } from '../../client/util';

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
  const [xy1, setMouseDownPosition] = useState<ReturnType<
    typeof toOutCoordinates
  > | null>(null);
  const [xy0, setMouseCurrentPosition] = useState<ReturnType<
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
