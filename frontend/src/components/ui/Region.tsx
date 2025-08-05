import { Rect } from 'acine-proto-dist';
import { toPercentage } from '../../client/util';

interface RegionProps {
  width: number;
  height: number;
  region: Rect;
  children?: React.ReactNode;

  color?: string; // classname override
}

/**
 * Helper function for rendering a non-interactive rectangular region
 * (using HTML).
 *
 * For color, use outline is recommended
 */
export default function Region({
  width,
  height,
  region,
  children,
  color = 'color-amber-400 outline-amber-400 hover:outline-amber-500',
}: RegionProps) {
  const { top, left, bottom, right } = region;
  return (
    <div
      className={
        'absolute outline-4 pointer-events-auto select-none box-border overflow-x-visible whitespace-nowrap ' +
        color
      }
      draggable={false}
      style={{
        left: toPercentage(left / width),
        top: toPercentage(top / height),
        width: toPercentage((right - left) / width),
        height: toPercentage((bottom - top) / height),
      }}
    >
      {children}
    </div>
  );
}
