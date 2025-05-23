import { useStore } from '@nanostores/react';
import { Routine_State } from 'acine-proto-dist';

import { $frames, $sourceDimensions } from '@/state';
import EditableRoutineProperty from '@/ui/EditableRoutineProperty';
import MouseRegion from '@/ui/MouseRegion';
import { toPercentage } from '../client/util';
import { Selectable } from './types';
import useForceUpdate from './useForceUpdate';

interface StateProps extends Selectable {
  state: Routine_State;
}

function State({ state, selected = false }: StateProps) {
  const frames = useStore($frames);
  const [width, height] = useStore($sourceDimensions);
  const forceUpdate = useForceUpdate();

  return (
    // slight padding so you can see the highlighted background everywhere
    <div className={`pl-1 border border-black ${selected && 'bg-amber-100'}`}>
      <div className='w-full flex flex-row justify-between items-center'>
        <EditableRoutineProperty
          object={state}
          property='name'
          callback={forceUpdate}
          className='flex-grow font-semibold font-mono'
        />
        <div className='flex flex-row text-xs'>
          id={state.id} ({state.samples.length} samples)
        </div>
      </div>
      <EditableRoutineProperty
        object={state}
        property={'description'}
        callback={forceUpdate}
        className='text-sm'
      />
      <MouseRegion
        outWidth={width}
        outHeight={height}
        onDragRegion={(region) => {
          // something about resetting the region to no selection
          state.region = region;
          forceUpdate();
          // console.log(region, width, height);
        }}
      >
        {state.samples.slice(0, 1).map((sampleId, index) => (
          // takes up space (to expand parent box properly)
          <img
            key={index}
            src={frames[sampleId]}
            className='opacity-0'
            draggable={false}
          />
        ))}
        {state.samples.map((sampleId, index) => (
          <img
            key={index}
            src={frames[sampleId]}
            className='absolute left-0 top-0 pointer-events-none'
            style={{ opacity: 1 / (index + 1) }}
            // use harmonic series to have even opacity of all images
          />
        ))}
        {state.region && (
          <div
            // need pointer-events-none to prevent it from affecting ev.target
            // in the mouseregion listener
            className='absolute outline-4 outline-amber-300 pointer-events-none'
            style={{
              left: toPercentage(state.region.left / width),
              top: toPercentage(state.region.top / height),
              width: toPercentage(
                (state.region.right - state.region.left) / width,
              ),
              height: toPercentage(
                (state.region.bottom - state.region.top) / height,
              ),
            }}
          ></div>
        )}
      </MouseRegion>
      <div className='grid grid-cols-4'>
        {state.samples.map((sampleId, index) => (
          <img
            key={index}
            src={frames[sampleId]}
            draggable={false}
            className='hover:opacity-40'
            onClick={() => {
              state.samples.splice(index, 1);
              forceUpdate();
            }}
          />
        ))}
      </div>
    </div>
  );
}

export default State;
