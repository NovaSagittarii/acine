import { useStore } from '@nanostores/react';
import {
  Routine_Node,
  Routine_Node_NodeType as NodeType,
} from 'acine-proto-dist';

import EditableRoutineProperty from './EditableRoutineProperty';
import Select from './Select';
import { $routine } from '../state';

interface NodeProps {
  node: Routine_Node;
  selected?: boolean;
}

const NODE_TYPES_DISPLAY = [
  ['standard', NodeType.NODE_TYPE_STANDARD],
  ['init', NodeType.NODE_TYPE_INIT],
  ['return', NodeType.NODE_TYPE_RETURN],
] as [string, NodeType][];

function Node({ node, selected = false }: NodeProps) {
  const routine = useStore($routine);

  return (
    <div className={`pl-1 border border-black ${selected && 'bg-amber-100'}`}>
      <EditableRoutineProperty
        object={node}
        property={'name'}
        className='font-semibold font-mono'
      />
      <EditableRoutineProperty
        object={node}
        property={'description'}
        className='text-sm'
      />
      <div className='flex flex-row text-sm font-mono'>
        <Select
          className='p-0 appearance-none'
          values={NODE_TYPES_DISPLAY}
          onChange={(t) => {
            node.type = t;
            $routine.set(routine);
          }}
        />
        <div className='opacity-50'> : type </div>
      </div>
    </div>
  );
}

export default Node;
