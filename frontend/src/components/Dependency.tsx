import {
  Routine_Dependency,
  Routine_Edge_EdgeTriggerType,
} from 'acine-proto-dist';
import useForceUpdate from './useForceUpdate';
import NumberInput from './ui/NumberInput';
import { LabeledSelect } from './ui/Select';
import { $routine } from '@/state';
import { useStore } from '@nanostores/react';
import { getEdgeDisplay } from './Edge.util';
import { REQUIREMENT_TYPE_DISPLAY } from './display';
import { runtimeQueueEdge } from '../App.state';
import { compare } from '../client/util';

interface DependencyProps {
  dependency: Routine_Dependency;
}

export default function Dependency({ dependency }: DependencyProps) {
  const routine = useStore($routine);
  const forceUpdate = useForceUpdate();
  return (
    <div className='relative flex flex-col hover:bg-amber-100 border border-black p-1 rounded-sm'>
      <div className='absolute flex gap-4 top-0 right-0 opacity-50 text-xs p-1'>
        <div
          className='hover:bg-red-100'
          onClick={() => void runtimeQueueEdge(dependency.requires)}
        >
          exec
        </div>
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
        values={Object.values(routine.nodes)
          .sort((a, b) => compare(a.name, b.name))
          .flatMap((n) =>
            n.edges
              .filter(
                (e) =>
                  e.trigger ===
                  Routine_Edge_EdgeTriggerType.EDGE_TRIGGER_TYPE_SCHEDULED,
              )
              .map(
                (e) =>
                  [
                    `${n.name}=>${routine.nodes[e.to].name} - ${getEdgeDisplay(e)}`,
                    e.id,
                  ] as [string, string],
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
