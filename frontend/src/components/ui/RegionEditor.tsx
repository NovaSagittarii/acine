import { Rect } from 'acine-proto-dist';
import useForceUpdate from '../useForceUpdate';
import MouseRegion from './MouseRegion';
import { toOutCoordinates as _t } from 'src/client/util';
import { constrain as _constrain, toPercentage } from '../../client/util';
import { useEffect as _useEffect, useState } from 'react';

interface RegionEditorProps {
  width: number;
  height: number;
  composite?: boolean;
  regions: Rect[];
  children: React.ReactNode;
  onChange: (regions: Rect[]) => void;
}

/**
 * Composite rectangular region editor.
 * Need to update regions prop (from onChange updates) to see updates
 * since you'd typically need to use these values for *something*.
 *
 * Drag to move is too broken to use.
 * The commented sections sort of implement it with very poor UX.
 */
export default function RegionEditor({
  width,
  height,
  regions = [],
  composite = false,
  children,
  onChange,
}: RegionEditorProps) {
  const forceUpdate = useForceUpdate();
  const [hoveredRegion, setHoveredRegion] = useState<Rect | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<Rect | null>(null);

  // cursed drag to move

  // const [xy1, setMouseDownPosition] = useState<ReturnType<
  //   typeof toOutCoordinates
  // > | null>(null);
  // const [xy0, setMouseCurrentPosition] = useState<ReturnType<
  //   typeof toOutCoordinates
  // > | null>(null);

  // useEffect(() => {
  //   // repositioning selected region
  //   if (selectedRegion && xy0 && xy1) {
  //     const { left, top, right, bottom } = selectedRegion;
  //     const dx = Math.round((xy0.x - xy1.x) / 10);
  //     const dy = Math.round((xy0.y - xy1.y) / 10);
  //     const nx0 = constrain(left + dx, 0, width);
  //     const nx1 = constrain(right + dx, 0, width);
  //     const ny0 = constrain(top + dy, 0, height);
  //     const ny1 = constrain(bottom + dy, 0, height);
  //     const ndx = dx > 0 ? nx1 - right : nx0 - left;
  //     const ndy = dy > 0 ? ny1 - bottom : ny0 - top;
  //     selectedRegion.left += ndx;
  //     selectedRegion.right += ndx;
  //     selectedRegion.bottom += ndy;
  //     selectedRegion.top += ndy;
  //   }
  // }, [xy1, xy0, selectedRegion]);

  return (
    <MouseRegion
      // without `select-none` you can somehow select the image
      className='flex overflow-hidden justify-center select-none w-fit'
      disabled={hoveredRegion !== null}
      outWidth={width}
      outHeight={height}
      onDragRegion={(region) => {
        if (region.bottom === region.top || region.right === region.left) {
          return;
        }
        let newRegions = [region];
        if (composite) {
          newRegions = [...regions, region];
        }
        forceUpdate(); // setRegions(newRegions);
        onChange(newRegions);
        setSelectedRegion(region);
        // console.log(region, width, height);
      }}
      // onMouseDown={(ev) => {
      //   setMouseDownPosition(toOutCoordinates(width, height, ev));
      // }}
      // onMouseUp={() => setMouseDownPosition(null)}
      // onMouseMove={(ev) => {
      //   setMouseCurrentPosition(toOutCoordinates(width, height, ev));
      // }}
    >
      {children}
      {regions.map((region, index) => {
        const { top, left, bottom, right } = region;
        return (
          <div
            key={index}
            className='absolute outline-4 outline-amber-300 hover:outline-amber-600 select-none box-border overflow-x-visible whitespace-nowrap'
            draggable={false}
            onMouseOver={() => {
              setHoveredRegion(region);
            }}
            onMouseOut={() => {
              setHoveredRegion((r) => (r === region ? null : r));
            }}
            onMouseDown={() => {
              setSelectedRegion(region);
            }}
            // onMouseUp={() => setMouseDownPosition(null)}
            style={{
              left: toPercentage(left / width),
              top: toPercentage(top / height),
              width: toPercentage((right - left) / width),
              height: toPercentage((bottom - top) / height),
            }}
          >
            {(selectedRegion === region || hoveredRegion === region) && (
              <>
                <div
                  className='text-red-500 hover:text-white hover:bg-red-500 w-fit'
                  onClick={(ev) => {
                    regions.splice(index, 1);
                    forceUpdate(); // setRegions(regions);
                    if (selectedRegion === region) setHoveredRegion(null);
                    if (hoveredRegion === region) setSelectedRegion(null);
                    ev.preventDefault();
                    // preventDefault prevents chained deletions
                    // but idk why it deselects the selected item on delete
                  }}
                >
                  delete
                </div>
                <div
                  className='text-orange-500 hover:text-white hover:bg-orange-500 w-fit'
                  onClick={() => setSelectedRegion(null)}
                >
                  deselect
                </div>
                {/* <div className='text-orange-500 w-fit'>move (drag)</div> */}
                <div className='text-orange-500/50 hover:text-white hover:bg-orange-400 w-fit'>
                  {`left: ${left} top: ${top}`} <br />
                  {`right: ${right} bottom: ${bottom}`}
                </div>
              </>
            )}
          </div>
        );
      })}
    </MouseRegion>
  );
}
