import { $routine } from '@/state';
import { atom } from 'nanostores';
import { useStore } from '@nanostores/react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { GraphCanvas, GraphCanvasRef, GraphEdge, GraphNode } from 'reagraph';
import Checkbox from '../ui/Checkbox';
import { Routine_Edge, Routine_Edge_EdgeTriggerType } from 'acine-proto-dist';
import Edge from '../Edge';
import { getImageUrl } from '../../App.state';

const $is3d = atom(false);
const $follow = atom(true);

type NodeType = Routine_Edge;

export default function RoutineViewer() {
  const is3d = useStore($is3d); // persist between menu change
  const follow = useStore($follow); // follow runtime (highlight)
  const graphRef = useRef<GraphCanvasRef | null>(null);

  const routine = useStore($routine);
  const dnodes = Object.fromEntries(
    Object.values(routine.nodes).flatMap((n) =>
      n.edges
        .filter(
          (e) =>
            e.trigger ===
            Routine_Edge_EdgeTriggerType.EDGE_TRIGGER_TYPE_SCHEDULED,
        )
        .map((e) => {
          e.u = n.id;
          return [e.id, e];
        }),
    ),
  );

  const [selectedNode, setSelectedNode] = useState<NodeType | null>(null);

  const nodes = useCallback(() => {
    return Object.values(dnodes)
      .map((u) => {
        const extra = {} as GraphNode;
        const n = routine.nodes[u.u];
        if (!n) return null;
        if (n.defaultCondition?.condition?.$case === 'image') {
          const { frameId } = n.defaultCondition.condition.image;
          const url = getImageUrl(frameId);
          extra.icon = url;
        }
        return {
          ...extra,
          id: u.id,
          label: n.name,
          subLabel: n.description,
        } as GraphNode;
      })
      .filter((x) => x !== null);
  }, [routine, dnodes]);
  const edges = useCallback(() => {
    return Object.values(dnodes).flatMap((u) =>
      u.dependencies.map(
        (d) =>
          ({
            source: u.id,
            target: d.requires,
            id: d.id,
            label: `x${d.count}`,
            size: 3,
          }) as GraphEdge,
      ),
    );
  }, [dnodes]);

  useEffect(() => {
    if (follow) {
      if (selectedNode) graphRef.current?.centerGraph([selectedNode.id]);
    } else graphRef.current?.fitNodesInView();
  }, [follow, selectedNode, graphRef]);

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
          onNodeClick={(node) => setSelectedNode(dnodes[node.id])}
          // onEdgeClick={(e) => runtimeQueueEdge(e.id)}
          selections={follow && selectedNode ? [selectedNode.id] : []}
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
      </div>
      {Object.keys(dnodes).length === 0 && (
        <div className='absolute flex items-center justify-center w-full h-full'>
          No nodes. You must create [scheduled] edges.
        </div>
      )}
      {follow && selectedNode && (
        <div
          className={
            // 'absolute right-0 ' +
            'flex flex-col w-full h-full overflow-y-auto transition-all ease-in ' +
            'bg-amber-50 hover:bg-white/50 ' +
            'opacity-40 hover:opacity-100 ' +
            'border-l-4 border-amber-500/10 hover:border-amber-500'
          }
          style={{
            scrollbarWidth: 'thin',
          }}
        >
          <Edge edge={selectedNode} fixedType showDependencies />
        </div>
      )}
    </div>
  );
}
