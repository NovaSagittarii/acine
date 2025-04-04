import {
  Routine_Node,
  Routine_Node_NodeType as NodeType,
} from 'acine-proto-dist';

import EditableRoutineProperty from '@/ui/EditableRoutineProperty';
import Select from '@/ui/Select';
import { Selectable } from './types';
import EdgeList from './EdgeList';
import useForceUpdate from './useForceUpdate';

interface NodeProps extends Selectable {
  node: Routine_Node;
}

const NODE_TYPES_DISPLAY = [
  ['standard', NodeType.NODE_TYPE_STANDARD],
  ['init', NodeType.NODE_TYPE_INIT],
  ['return', NodeType.NODE_TYPE_RETURN],
] as [string, NodeType][];

function Node({ node, selected = false }: NodeProps) {
  const forceUpdate = useForceUpdate();

  return (
    <div className={`pl-1 border border-black ${selected && 'bg-amber-100'}`}>
      <EditableRoutineProperty
        object={node}
        property={'name'}
        callback={forceUpdate}
        className='font-semibold font-mono'
      />
      <EditableRoutineProperty
        object={node}
        property={'description'}
        callback={forceUpdate}
        className='text-sm'
      />
      <div className='flex flex-row text-sm font-mono'>
        <Select
          className='p-0 appearance-none'
          values={NODE_TYPES_DISPLAY}
          onChange={(t) => {
            node.type = t;
            forceUpdate();
          }}
        />
        <div className='opacity-50'> : type </div>
      </div>

      <div>
        <EdgeList node={node} />
      </div>
    </div>
  );
}

export default Node;
