import { useStore } from '@nanostores/react';
import { Routine_Edge, Routine_Node } from 'acine-proto-dist';

import Button, { CloseButton } from '@/ui/Button';
import Edge from '@/components/Edge';
import { $routine, $runtimeContext, $selectedNode } from '@/state';
import useForceUpdate from './useForceUpdate';
import Collapse from './ui/Collapse';
import { choices, getEdgeDisplay, getEdgeIcon } from './Edge.util';
import { $currentEdge } from './Edge.state';
import useShortcut, { DigitKeys, FKeys, ShortcutType } from './useShortcut';
import { useState } from 'react';

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
              runtimeContext?.currentNode?.id === node.id && DigitKeys[index]
            }
            shortcutLabel={`edge "${routine.nodes[edge.to]?.name}"`}
            className='relative'
            key={edge.id} // don't keep a previous Collapse open when deleted
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
            <DeleteEdgeButton
              index={index}
              node={node}
              edge={edge}
              forceUpdate={forceUpdate}
            />
          </Collapse>
        ))}
      </div>
      {(tools || selectedNode === node) && (
        <EdgePresets forceUpdate={forceUpdate} node={node} />
      )}
    </div>
  );
}

function EdgePresets({
  forceUpdate,
  node,
}: {
  node: Routine_Node;
  forceUpdate: ReturnType<typeof useForceUpdate>;
}) {
  const [isAltDown, setAltDown] = useState(false);
  const currentEdge = useStore($currentEdge);
  useShortcut(!currentEdge && 'KeyE', {
    label: '+edge presets',
    type: ShortcutType.WHILE_PRESSED,
    onKeyDown: () => setAltDown(true),
    onKeyUp: () => setAltDown(false),
  });
  return (
    <div className='w-full flex flex-col'>
      <div className='text-lg font-semibold'>Edge Presets</div>
      <div className='w-full flex flex-wrap gap-2'>
        {choices.map(({ name, method }, index) => (
          <Button
            compact
            variant='minimal'
            key={index}
            shortcut={isAltDown && FKeys[index]}
            className='hover:bg-red-100'
            onClick={() => {
              const newEdge = method();
              node.edges.push(newEdge);
              forceUpdate();
            }}
          >
            {name}
          </Button>
        ))}
      </div>
    </div>
  );
}

function DeleteEdgeButton({
  node,
  index,
  edge,
  forceUpdate,
}: {
  index: number;
  node: Routine_Node;
  edge: Routine_Edge;
  forceUpdate: ReturnType<typeof useForceUpdate>;
}) {
  const currentEdge = useStore($currentEdge);
  return (
    <CloseButton
      onClick={() => {
        node.edges.splice(index, 1);
        forceUpdate();
      }}
      shortcut={edge === currentEdge && 'Delete'}
      shortcutLabel='Delete selected edge'
    />
  );
}
