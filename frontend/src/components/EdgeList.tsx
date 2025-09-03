import { useStore } from '@nanostores/react';
import { Routine_Node } from 'acine-proto-dist';

import { CloseButton } from '@/ui/Button';
import Edge from '@/components/Edge';
import { $routine, $selectedNode } from '@/state';
import useForceUpdate from './useForceUpdate';
import Collapse from './ui/Collapse';
import { choices, getEdgeDisplay } from './Edge.util';

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
            label={`* ${routine.nodes[edge.to]?.name ?? '<unset>'} ${getEdgeDisplay(edge).substring(0, 50)}`}
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
        <div className='w-full flex flex-col'>
          <div className='text-lg font-semibold'>Edge Presets</div>
          <div className='w-full flex flex-wrap gap-2'>
            {choices.map(({ name, method }, index) => (
              <div
                key={index}
                className='hover:bg-red-100'
                onClick={() => {
                  const newEdge = method();
                  node.edges.push(newEdge);
                  forceUpdate();
                }}
              >
                {name}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
