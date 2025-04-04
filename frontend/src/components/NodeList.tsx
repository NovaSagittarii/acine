import { useStore } from '@nanostores/react';
import { Routine_Node } from 'acine-proto-dist';

import { $routine, $selectedNode } from '@/state';
import Button from '@/ui/Button';
import Node from '@/components/Node';

/**
 * Editor for nodes & transitions of the DFA.
 */
function NodeEditor() {
  const routine = useStore($routine);
  const selectedNode = useStore($selectedNode);

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
            id: Date.now(),
            name: 'unnamed node',
            description: 'desc',
          });
          routine.nodes.push(newNode);
          $routine.set(routine);
          $selectedNode.set(newNode);
        }}
      >
        Add State
      </Button>
    </div>
  );
}

export default NodeEditor;
