import { $frames, $routine, $runtimeContext } from '@/state';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { useCallback } from 'react';
import { GraphCanvas, GraphEdge, GraphNode } from 'reagraph';
import { runtimeGoto, runtimeQueueEdge } from '../App.state';
import Checkbox from './ui/Checkbox';
import { getEdgeDisplay } from './Edge.util';
import Node from './Node';

const $is3d = atom(false);
const $showSelected = atom(true);

export default function RoutineViewer() {
  const is3d = useStore($is3d); // persist between menu change
  const showSelected = useStore($showSelected);

  const routine = useStore($routine);
  const context = useStore($runtimeContext);
  const frames = useStore($frames);
  const nodes = useCallback(() => {
    return Object.values(routine.nodes).map((n) => {
      const extra = {} as GraphNode;
      if (n.defaultCondition?.condition?.$case === 'image') {
        const { frameId } = n.defaultCondition.condition.image;
        const url = frames[frameId];
        extra.icon = url;
      }
      return {
        ...extra,
        id: n.id,
        label: n.name,
        subLabel: n.description,
      } as GraphNode;
    });
  }, [frames, routine]);
  const edges = useCallback(() => {
    return Object.values(routine.nodes).flatMap((n) =>
      n.edges
        .map(
          (e) =>
            ({
              source: n.id.toString(),
              target: e.to.toString(),
              id: e.id,
              label: getEdgeDisplay(e).substring(0, 16),
              size: 3,
            }) as GraphEdge,
        )
        // suppress self loops, since they get rendered incorrectly
        // see https://github.com/reaviz/reagraph/issues/234
        .filter((e) => e.source != e.target),
    );
  }, [routine]);
  return (
    <div className='relative flex w-full h-full overflow-hidden'>
      <div className='relative block w-full h-full'>
        <GraphCanvas
          layoutType={!is3d ? 'forceDirected2d' : 'forceDirected3d'}
          cameraMode={!is3d ? 'pan' : 'rotate'}
          nodes={nodes()}
          edges={edges()}
          edgeInterpolation='curved' // make <-> 2-cycles more visible
          labelType='all'
          onNodeClick={(node) => runtimeGoto(node.id)}
          onEdgeClick={(e) => runtimeQueueEdge(e.id)} // it does work (highlight bugged)
          selections={
            showSelected
              ? [
                  context?.currentNode?.id?.toString() || '',
                  context?.currentEdge?.id?.toString() || '',
                ].filter((x) => x)
              : []
          }
          edgeLabelPosition={'above'} // for label readability
          // animated={false} // animated used to cause many spring errors; now just THREE.Color transparent errors
        />
        <div className='absolute top-0 left-0 flex flex-col'>
          <Checkbox value={is3d} onChange={(x) => $is3d.set(x)} label='3D' />
          <Checkbox
            value={showSelected}
            onChange={(x) => $showSelected.set(x)}
            label='Show selected'
          />
        </div>
        <div className='absolute bottom-0 left-0'>
          {context?.stackEdges
            .map((e) => routine.nodes[e.to].name)
            .join(', ') || 'Empty stack'}
        </div>
      </div>
      <div
        className={
          'absolute right-0 ' +
          'flex flex-col w-1/4 hover:w-1/2 h-full overflow-y-scroll transition-all ease-in ' +
          'bg-amber-50 hover:bg-white/50 ' +
          'opacity-20 hover:opacity-100 ' +
          'border-l-4 border-amber-500/10 hover:border-amber-500'
        }
      >
        {context.currentNode?.id && routine.nodes[context.currentNode.id] && (
          <Node node={routine.nodes[context.currentNode.id]} selected={true} />
        )}
      </div>
    </div>
  );
}
