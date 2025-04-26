import {
  Routine_Edge,
  Routine_Edge_EdgeTriggerType as TriggerType,
} from 'acine-proto-dist';

import { Selectable } from './types';
import EditableRoutineProperty from './ui/EditableRoutineProperty';
import Condition from './Condition';
import useForceUpdate from './useForceUpdate';
import { useStore } from '@nanostores/react';
import { $routine } from '@/state';
import Select from './ui/Select';
import ActionEditor from './ActionEditor';
import Collapse from './ui/Collapse';

const TRIGGER_TYPES_DISPLAY = [
  ['unset', TriggerType.EDGE_TRIGGER_TYPE_UNSPECIFIED],
  ['standard', TriggerType.EDGE_TRIGGER_TYPE_STANDARD],
  ['interrupt', TriggerType.EDGE_TRIGGER_TYPE_INTERRUPT],
] as [string, TriggerType][];

interface EdgeProps extends Selectable {
  edge: Routine_Edge;
}

export default function Edge({ edge, selected = false }: EdgeProps) {
  const routine = useStore($routine);
  const forceUpdate = useForceUpdate();

  return (
    <Collapse
      label={`* ${routine.nodes.find((n) => n.id === edge.to)?.name} -- ${edge.description.substring(0, 50)} (id=${edge.id})`}
    >
      <div className={`pl-1 border border-black ${selected && 'bg-amber-100'}`}>
        <EditableRoutineProperty
          object={edge}
          property={'description'}
          callback={forceUpdate}
        />
        <div>
          to
          <Select
            value={routine.nodes.map((n) => n.id).indexOf(edge.to)}
            values={routine.nodes.map((n) => [
              `${n.name} - ${n.description.substring(0, 24)}`,
              n.id,
            ])}
            onChange={(v) => {
              edge.to = v;
            }}
          />
        </div>
        <div className='flex flex-row text-sm font-mono'>
          <Select
            className='p-0 appearance-none'
            value={TRIGGER_TYPES_DISPLAY.findIndex(
              ([_, t]) => t === edge.trigger,
            )}
            values={TRIGGER_TYPES_DISPLAY}
            onChange={(t) => {
              edge.trigger = t;
              forceUpdate();
            }}
          />
          <div className='opacity-50'> : type </div>
        </div>

        <ActionEditor edge={edge} />
        <Collapse label={'precondition ' + edge.precondition?.condition?.$case}>
          precondition
          <Condition condition={edge.precondition!} allowAuto />
        </Collapse>
        <Collapse
          label={'postcondition ' + edge.postcondition?.condition?.$case}
        >
          postcondition
          <Condition condition={edge.postcondition!} allowAuto />
        </Collapse>
      </div>
    </Collapse>
  );
}
