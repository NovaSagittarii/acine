import { $routine, $runtimeContext } from '@/state';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useRef } from 'react';
import { GraphCanvas, GraphCanvasRef, GraphEdge, GraphNode } from 'reagraph';
import { getImageUrl, runtimeGoto, runtimeQueueEdge } from '../App.state';
import Checkbox from './ui/Checkbox';
import { getEdgeDisplay } from './Edge.util';
import Node from './Node';

const $is3d = atom(false);
const $follow = atom(true);

export default function RoutineViewer() {
  const is3d = useStore($is3d); // persist between menu change
  const follow = useStore($follow); // follow runtime (highlight)
  const graphRef = useRef<GraphCanvasRef | null>(null);

  const routine = useStore($routine);
  const context = useStore($runtimeContext);
  const nodes = useCallback(() => {
    return Object.values(routine.nodes).map((n) => {
      const extra = {} as GraphNode;
      if (n.defaultCondition?.condition?.$case === 'image') {
        const { frameId } = n.defaultCondition.condition.image;
        const url = getImageUrl(frameId);
        extra.icon = url;
      }
      return {
        ...extra,
        id: n.id,
        label: n.name,
        subLabel: n.description,
      } as GraphNode;
    });
  }, [routine]);
  const edges = useCallback(() => {
    return Object.values(routine.nodes).flatMap((n) =>
      n.edges
        .map(
          (e) =>
            ({
              source: n.id.toString(),
              target: e.to.toString(),
              id: e.id,
              label: getEdgeDisplay(e, true).substring(0, 16),
              size: 3,
            }) as GraphEdge,
        )
        // suppress self loops, since they get rendered incorrectly
        // see https://github.com/reaviz/reagraph/issues/234
        .filter((e) => e.source != e.target),
    );
  }, [routine]);

  useEffect(() => {
    if (follow && context?.currentNode?.id) {
      if (context?.stackEdges?.length) {
        graphRef.current?.fitNodesInView([
          context.currentNode.id,
          ...context.stackEdges.map((x) => x.to),
        ]);
      } else {
        graphRef.current?.centerGraph([context.currentNode.id]);
      }
    }
    if (!follow) graphRef.current?.fitNodesInView();
  }, [context?.stackEdges, context?.currentNode?.id, follow]);

  return (
    <div className='relative flex w-full h-full overflow-hidden'>
      <div className='relative block w-full h-full'>
        <GraphCanvas
          ref={graphRef}
          layoutType={!is3d ? 'forceDirected2d' : 'forceDirected3d'}
          cameraMode={!is3d ? 'pan' : 'rotate'}
          nodes={nodes()}
          edges={edges()}
          edgeInterpolation='curved' // make <-> 2-cycles more visible
          labelType='all'
          onNodeClick={(node) => runtimeGoto(node.id)}
          onEdgeClick={(e) => runtimeQueueEdge(e.id)} // it does work (highlight bugged)
          selections={
            follow
              ? [
                  context?.currentNode?.id?.toString() || '',
                  context?.currentEdge?.id?.toString() || '',
                  ...(context?.stackEdges?.map((x) => x.id) || []),
                ].filter((x) => x)
              : []
          }
          edgeLabelPosition={'above'} // for label readability
          // animated={false} // animated used to cause many spring errors; now just THREE.Color transparent errors
        />
        <div className='absolute top-0 left-0 flex flex-col'>
          <Checkbox value={is3d} onChange={(x) => $is3d.set(x)} label='3D' />
          <Checkbox
            value={follow}
            onChange={(x) => $follow.set(x)}
            label='Follow'
          />
        </div>
        <div className='absolute bottom-0 left-0'>
          {context?.stackEdges
            .map((e) => routine.nodes[e.to].name)
            .join(', ') || 'Empty stack'}
        </div>
      </div>
      {follow && (
        <div
          className={
            // 'absolute right-0 ' +
            'flex flex-col w-full h-full overflow-y-auto transition-all ease-in ' +
            'bg-amber-50 hover:bg-white/50 ' +
            // 'opacity-40 hover:opacity-100 ' +
            'border-l-4 border-amber-500/10 hover:border-amber-500'
          }
          style={{
            scrollbarWidth: 'thin',
          }}
        >
          {context.currentNode?.id && routine.nodes[context.currentNode.id] && (
            <Node node={routine.nodes[context.currentNode.id]} tools expand />
          )}
        </div>
      )}
    </div>
  );
}
