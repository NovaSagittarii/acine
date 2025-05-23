import { $routine } from '@/state';
import { useStore } from '@nanostores/react';
import { useCallback } from 'react';
import { GraphCanvas, GraphEdge, GraphNode } from 'reagraph';

export default function RoutineViewer() {
  const routine = useStore($routine);
  const nodes = useCallback(() => {
    return routine.nodes.map(
      (n) =>
        ({
          id: n.id,
          label: n.name,
          subLabel: n.description,
        }) as GraphNode,
    );
  }, [routine]);
  const edges = useCallback(() => {
    return routine.nodes.flatMap((n) =>
      n.edges
        .map(
          (e, eid) =>
            ({
              source: n.id.toString(),
              target: e.to.toString(),
              id: n.id + '+' + eid,
              label: e.description.substring(0, 12),
              size: 3,
            }) as GraphEdge,
        )
        // suppress self loops, since they get rendered incorrectly
        // see https://github.com/reaviz/reagraph/issues/234
        .filter((e) => e.source != e.target),
    );
  }, [routine]);
  return (
    <div className='relative block w-full h-full'>
      <GraphCanvas
        nodes={nodes()}
        edges={edges()}
        edgeInterpolation='curved' // make <-> 2-cycles more visible
        labelType='all'
        // selections={[routine.nodes[0].id.toString()]}
        edgeLabelPosition={'above'} // for label readability
        // animated={false} // animated used to cause many spring errors; now just THREE.Color transparent errors
        // onEdgeClick={(e) => console.log(e)} // it does work (highlight bugged)
      />
    </div>
  );
}
