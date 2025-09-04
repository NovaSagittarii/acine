import { useStore } from '@nanostores/react';

import { $routine, $selectedNode } from '@/state';
import Button, { CloseButton } from '@/ui/Button';
import Node from '@/components/Node';
import useForceUpdate from './useForceUpdate';
import { useEffect } from 'react';
import { NodePreset } from './Node.util';
import { compare } from '../client/util';

/**
 * Editor for nodes & transitions of the DFA.
 */
export default function NodeList() {
  const routine = useStore($routine);
  const selectedNode = useStore($selectedNode);
  const forceUpdate = useForceUpdate();

  useEffect(() => {
    // a way to persist scroll location
    if (selectedNode) {
      document
        .getElementById(selectedNode.id)
        ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [selectedNode]);

  return (
    <div className='w-full h-full pb-4 overflow-hidden flex flex-col gap-4'>
      <div className='h-full overflow-y-scroll'>
        {Object.values(routine.nodes).length === 0 && 'No nodes yet.'}
        {Object.values(routine.nodes)
          .sort((a, b) => compare(a.id, b.id))
          .map((node) => (
            <div
              id={node.id}
              key={node.id}
              className='relative'
              onClick={() => $selectedNode.set(node)}
            >
              <Node node={node} selected={node == selectedNode} />
              <CloseButton
                onClick={() => {
                  delete routine.nodes[node.id];
                  forceUpdate();
                }}
              />
            </div>
          ))}
      </div>
      <Button
        className='bg-black text-white'
        onClick={() => {
          const newNode = NodePreset.base();
          routine.nodes[newNode.id] = newNode;
          forceUpdate();
          $selectedNode.set(newNode);
        }}
      >
        Add State
      </Button>
    </div>
  );
}
