import { Routine_Dependency } from 'acine-proto-dist';
import useForceUpdate from './useForceUpdate';
import NumberInput from './ui/NumberInput';
import { LabeledSelect } from './ui/Select';
import { $routine } from '@/state';
import { useStore } from '@nanostores/react';
import { getEdgeDisplay } from './Edge.util';
import { REQUIREMENT_TYPE_DISPLAY } from './display';

interface DependencyProps {
  dependency: Routine_Dependency;
}

export default function Dependency({ dependency }: DependencyProps) {
  const routine = useStore($routine);
  const forceUpdate = useForceUpdate();
  return (
    <div className='relative flex flex-col hover:bg-amber-100 border border-black p-1 rounded-sm'>
      <div className='absolute top-0 right-0 opacity-50 text-xs p-1'>
        {dependency.id}
      </div>
      <LabeledSelect
        label='condition'
        value={dependency.requirement}
        values={REQUIREMENT_TYPE_DISPLAY}
        onChange={(t) => {
          dependency.requirement = t;
          forceUpdate();
        }}
      />
      <LabeledSelect
        label='requires'
        value={dependency.requires}
        values={routine.nodes.flatMap((n) =>
          n.edges.map(
            (e) =>
              [`${n.name} - ${getEdgeDisplay(e)}`, e.id] as [string, string],
          ),
        )}
        onChange={(eid) => {
          dependency.requires = eid;
          forceUpdate();
        }}
      />
      <NumberInput
        object={dependency}
        property={'count'}
        callback={forceUpdate}
      />
    </div>
  );
}
