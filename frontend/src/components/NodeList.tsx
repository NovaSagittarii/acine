import { useStore } from '@nanostores/react';
import { Routine_Node, Routine_Node_NodeType } from 'acine-proto-dist';
import { v4 as uuidv4 } from 'uuid';

import { $routine, $selectedNode } from '@/state';
import Button from '@/ui/Button';
import Node from '@/components/Node';
import useForceUpdate from './useForceUpdate';

/**
 * Editor for nodes & transitions of the DFA.
 */
export default function NodeList() {
  const routine = useStore($routine);
  const selectedNode = useStore($selectedNode);
  const forceUpdate = useForceUpdate();

  return (
    <div className='w-full h-full pb-4 overflow-hidden flex flex-col gap-4'>
      <div className='h-full overflow-y-scroll'>
        {routine.nodes.length === 0 && 'No nodes yet.'}
        {routine.nodes.map((node) => (
          <div key={node.id} onClick={() => $selectedNode.set(node)}>
            <Node node={node} selected={node == selectedNode} />
          </div>
        ))}
      </div>
      <Button
        className='bg-black text-white'
        onClick={() => {
          const newNode = Routine_Node.create({
            id: uuidv4(),
            name: 'unnamed node',
            description: 'desc',
            type: Routine_Node_NodeType.NODE_TYPE_STANDARD,
          });
          routine.nodes.push(newNode);
          forceUpdate();
          $selectedNode.set(newNode);
        }}
      >
        Add State
      </Button>
    </div>
  );
}
