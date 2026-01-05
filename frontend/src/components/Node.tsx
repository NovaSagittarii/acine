import {
  Routine_Node,
  Routine_Node_NodeType as NodeType,
  Routine_Condition,
} from 'acine-proto-dist';

import EditableRoutineProperty from '@/ui/EditableRoutineProperty';
import { Selectable } from './types';
import EdgeList from './EdgeList';
import useForceUpdate from './useForceUpdate';
import { useEffect } from 'react';
import Condition, { ConditionDescription } from './Condition';
import Collapse from './ui/Collapse';
import { runtimeGoto, runtimeSetCurr } from '../App.state';
import SelectTab from './ui/SelectTab';

interface NodeProps extends Selectable {
  node: Routine_Node;

  /** extra tools? (edge create) */
  tools?: boolean;

  /** initally open? */
  expand?: boolean;
}

function Node({
  node,
  selected = false,
  tools = false,
  expand = false,
}: NodeProps) {
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    // ensure it exists; protos created before this don't have it
    if (!node.defaultCondition) {
      node.defaultCondition = Routine_Condition.create();
    }
  }, [node]);

  return (
    <div
      className={`flex flex-col gap-1 px-1 border ${selected ? 'border-amber-800 bg-amber-50' : 'border-black'}`}
    >
      <div className='w-full flex flex-row justify-between items-center'>
        <EditableRoutineProperty
          object={node}
          property={'name'}
          callback={forceUpdate}
          className='font-semibold grow'
        />
        <div className='flex flex-row text-xs gap-2'>
          <div
            className='hover:bg-red-100'
            onClick={() => void runtimeSetCurr(node.id)}
          >
            set
          </div>
          <div
            className='hover:bg-red-100'
            onClick={() => void runtimeGoto(node.id)}
          >
            nav
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
      <SelectTab
        label={'type'}
        value={node.type}
        values={[
          {
            label: 'standard',
            value: NodeType.NODE_TYPE_STANDARD,
            tooltip: 'Standard node with no special properties.',
          },
          {
            label: 'init',
            value: NodeType.NODE_TYPE_INIT,
            tooltip: 'Start of a subroutine.',
          },
          {
            label: 'return',
            value: NodeType.NODE_TYPE_RETURN,
            tooltip: 'End of a subroutine (successful return).',
          },
        ]}
        onChange={(v) => {
          node.type = v;
          forceUpdate();
        }}
      />
      {node.defaultCondition && (
        <Collapse
          label={
            <div className='flex gap-2'>
              defaultCondition
              <ConditionDescription condition={node.defaultCondition} />
            </div>
          }
          open={expand}
          shortcut={'KeyD'}
          shortcutLabel={'default condition'}
        >
          <Condition condition={node.defaultCondition} />
        </Collapse>
      )}

      <div>
        <div className='text-lg font-semibold mt-4'>Edges</div>
        <EdgeList node={node} tools={tools} expand={expand} />
      </div>
    </div>
  );
}

export default Node;
