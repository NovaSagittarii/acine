import { useStore } from '@nanostores/react';
import {
  Routine_Condition,
  Routine_Edge,
  Routine_Node,
} from 'acine-proto-dist';
import { v4 as uuidv4 } from 'uuid';

import Button, { CloseButton } from '@/ui/Button';
import Edge from '@/components/Edge';
import { $routine, $selectedNode } from '@/state';
import useForceUpdate from './useForceUpdate';
import Collapse from './ui/Collapse';
import { getEdgeDisplay } from './Edge.util';

interface EdgeListProps {
  node: Routine_Node;
}

/**
 * Editor for nodes & transitions of the DFA.
 */
export default function EdgeList({ node }: EdgeListProps) {
  const routine = useStore($routine);
  const selectedNode = useStore($selectedNode);
  const forceUpdate = useForceUpdate();
  return (
    <div className='w-full max-h-full pb-4 overflow-hidden flex flex-col gap-4'>
      <div className='max-h-full overflow-y-auto'>
        {node.edges.length === 0 && 'no edges (type=RETURN)'}
        {node.edges.map((edge, index) => (
          <Collapse
            className='relative'
            key={index}
            label={`* ${routine.nodes.find((n) => n.id === edge.to)?.name} -- ${getEdgeDisplay(edge).substring(0, 50)} (id=${edge.id})`}
          >
            <Edge edge={edge} />
            <CloseButton
              onClick={() => {
                node.edges.splice(index, 1);
                forceUpdate();
              }}
            />
          </Collapse>
        ))}
      </div>
      {selectedNode === node && (
        <Button
          className='bg-black text-white text-sm p-2!'
          onClick={() => {
            const newEdge = Routine_Edge.create({
              id: uuidv4(),
              precondition: Routine_Condition.create({
                // precondition timeout sort of doesn't make sense
                // since it needed to pass before it is taken...
                delay: 0,
                interval: 0,
                timeout: 50,
              }),
              postcondition: Routine_Condition.create({
                delay: 0,
                interval: 10,
                // unset timeout (defaults to 30 seconds)

                // you probably want to use the destination node
                // default_condition since most transitions are
                // state transitions
                condition: { $case: 'auto', auto: true },
              }),
              limit: -1,
              // empty description defaults to destination node name
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
