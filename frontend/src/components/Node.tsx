import {
  Routine_Node,
  Routine_Node_NodeType as NodeType,
  Routine_Condition,
} from 'acine-proto-dist';

import EditableRoutineProperty from '@/ui/EditableRoutineProperty';
import Select from '@/ui/Select';
import { Selectable } from './types';
import EdgeList from './EdgeList';
import useForceUpdate from './useForceUpdate';
import { useEffect } from 'react';
import Condition from './Condition';
import Collapse from './ui/Collapse';
import { runtimeSetCurr } from '../App.state';

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

  useEffect(() => {
    // ensure it exists; protos created before this don't have it
    if (!node.defaultCondition) {
      node.defaultCondition = Routine_Condition.create();
    }
  }, [node]);

  return (
    <div
      className={`pl-1 border ${selected ? 'border-amber-800 bg-amber-50' : 'border-black'}`}
    >
      <div className='w-full flex flex-row justify-between items-center'>
        <EditableRoutineProperty
          object={node}
          property={'name'}
          callback={forceUpdate}
          className='font-semibold grow'
        />
        <div className='flex flex-row text-xs'>
          <div
            className='hover:bg-red-100'
            onClick={async () => void (await runtimeSetCurr(node.id))}
          >
            goto
          </div>
          id={node.id} (outdegree={node.edges.length})
        </div>
      </div>
      <EditableRoutineProperty
        object={node}
        property={'description'}
        callback={forceUpdate}
        className='text-sm'
      />
      <div className='flex flex-row'>
        <Select
          className='p-0 appearance-none'
          value={node.type}
          values={NODE_TYPES_DISPLAY}
          onChange={(t) => {
            node.type = t;
            forceUpdate();
          }}
        />
        <div className='opacity-50'> : type </div>
      </div>
      {node.defaultCondition && (
        <Collapse
          label={
            'defaultCondition ' +
            (node.defaultCondition.condition?.$case || 'true')
          }
        >
          defaultCondition
          <Condition condition={node.defaultCondition} />
        </Collapse>
      )}

      <div>
        <EdgeList node={node} />
      </div>
    </div>
  );
}

export default Node;
