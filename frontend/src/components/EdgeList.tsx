import { useStore } from '@nanostores/react';
import { Routine_Node } from 'acine-proto-dist';

import { CloseButton } from '@/ui/Button';
import Edge from '@/components/Edge';
import { $routine, $runtimeContext, $selectedNode } from '@/state';
import useForceUpdate from './useForceUpdate';
import Collapse from './ui/Collapse';
import { choices, getEdgeDisplay, getEdgeIcon } from './Edge.util';
import { $currentEdge } from './Edge.state';
import { KeyCode } from './useShortcut';

interface EdgeListProps {
  node: Routine_Node;

  tools?: boolean;

  expand?: boolean;
}

/**
 * Editor for nodes & transitions of the DFA.
 */
export default function EdgeList({
  node,
  tools = false,
  expand = false,
}: EdgeListProps) {
  const routine = useStore($routine);
  const selectedNode = useStore($selectedNode);
  const runtimeContext = useStore($runtimeContext);
  const forceUpdate = useForceUpdate();
  return (
    <div className='w-full max-h-full pb-4 overflow-hidden flex flex-col gap-4'>
      <div className='max-h-full overflow-y-auto'>
        {node.edges.length === 0 && 'no edges (type=RETURN)'}
        {node.edges.map((edge, index) => (
          <Collapse
            shortcut={
              runtimeContext?.currentNode?.id === node.id &&
              (
                [
                  'Digit1',
                  'Digit2',
                  'Digit3',
                  'Digit4',
                  'Digit5',
                  'Digit6',
                  'Digit7',
                  'Digit8',
                  'Digit9',
                  'Digit0',
                ] as KeyCode[]
              )[index]
            }
            shortcutLabel={`edge "${routine.nodes[edge.to]?.name}"`}
            className='relative'
            key={index}
            label={
              <div className='flex items-center gap-2'>
                <div className='font-mono text-blue-500 flex items-center justify-center text-xs w-4 h-4 border border-black/50 rounded-full'>
                  {getEdgeIcon(edge)}
                </div>
                {`${routine.nodes[edge.to]?.name ?? '<unset>'} ${getEdgeDisplay(edge).substring(0, 50)}`}
              </div>
            }
            open={expand}
            onOpen={() => $currentEdge.set(edge)}
            onClose={() =>
              edge === $currentEdge.get() && $currentEdge.set(null)
            }
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
      {(tools || selectedNode === node) && (
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
