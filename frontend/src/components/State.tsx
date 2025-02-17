import { useStore } from '@nanostores/react';
import { Routine_State } from 'acine-proto-dist';

import { $frames, $routine } from '../state';
import EditableText from './EditableText';

interface StateProps {
  state: Routine_State;
  selected?: boolean;
}

function State({ state, selected = false }: StateProps) {
  const routine = useStore($routine);
  const frames = useStore($frames);

  return (
    <div className={`border border-black ${selected && 'bg-amber-100'}`}>
      {state.id}
      <EditableText
        onChange={(s) => {
          state.name = s;
          $routine.set(routine);
        }}
      >
        {state.name}
      </EditableText>
      <EditableText
        onChange={(s) => {
          state.description = s;
          $routine.set(routine);
        }}
      >
        {state.description}
      </EditableText>
      {state.samples.map((sampleId, index) => (
        <img key={index} src={frames[sampleId]} />
      ))}
    </div>
  );
}

export default State;
