import { useStore } from '@nanostores/react';
import { Routine_State } from 'acine-proto-dist';

import { $routine, $selectedState } from '../state';
import Button from './Button';
import State from './State';

function StateList() {
  const routine = useStore($routine);
  // god this is painnnn (the fact that it rerenders)
  // might run into issues with performance (frames are big)
  // on another note... it seems you can just use $routine.set(routine)
  // to refresh changes instead of having to rebuild the object,
  // that seems acceptable
  // might still be expensive to rebuild components though (?)

  const selectedState = useStore($selectedState);

  return (
    <div className='w-full h-full p-8 flex flex-col gap-4'>
      <div className='h-full overflow-y-auto'>
        {routine.states.length === 0 && 'No states yet.'}
        {routine.states.map((state) => (
          <div key={state.id} onClick={() => $selectedState.set(state)}>
            <State state={state} selected={state == selectedState} />
          </div>
        ))}
      </div>
      <Button
        className='bg-black text-white'
        onClick={() => {
          routine.states.push(
            Routine_State.create({
              id: Date.now(),
              name: 'new state',
              description: 'desc',
            }),
          );
          $routine.set(routine);
        }}
      >
        Add State
      </Button>
    </div>
  );
}

export default StateList;
