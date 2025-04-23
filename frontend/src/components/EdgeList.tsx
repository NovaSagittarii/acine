import { useStore } from '@nanostores/react';
import {
  Routine_Condition,
  Routine_Edge,
  Routine_Node,
} from 'acine-proto-dist';
import { v4 as uuidv4 } from 'uuid';

import Button from '@/ui/Button';
import Edge from '@/components/Edge';
import { $selectedNode } from '@/state';
import useForceUpdate from './useForceUpdate';

interface EdgeListProps {
  node: Routine_Node;
}

/**
 * Editor for nodes & transitions of the DFA.
 */
export default function EdgeList({ node }: EdgeListProps) {
  const selectedNode = useStore($selectedNode);
  const forceUpdate = useForceUpdate();
  return (
    <div className='w-full max-h-full pb-4 overflow-hidden flex flex-col gap-4'>
      <div className='max-h-full overflow-y-auto'>
        {node.edges.length === 0 && 'no edges (type=RETURN)'}
        {node.edges.map((edge, index) => (
          <div key={index}>
            <Edge edge={edge} />
          </div>
        ))}
      </div>
      {selectedNode === node && (
        <Button
          className='bg-black text-white text-sm p-2!'
          onClick={() => {
            const newEdge = Routine_Edge.create({
              id: uuidv4(),
              precondition: Routine_Condition.create({
                delay: 50,
                interval: 100,
              }),
              postcondition: Routine_Condition.create({
                delay: 50,
                interval: 100,
                // you probably want to use the destination node
                // default_condition since most transitions are
                // state transitions
                condition: { $case: 'auto', auto: true },
              }),
              limit: -1,
              description: 'desc',
            });
            node.edges.push(newEdge);
            forceUpdate();
          }}
        >
          Add Transition
        </Button>
      )}
    </div>
  );
}
