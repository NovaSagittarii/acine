/* eslint-disable */

import { $routine } from '@/state';
import { useStore } from '@nanostores/react';
import { useCallback, useState } from 'react';
import { $nodes } from './util';
import { Routine_Edge, Routine_Edge_EdgeTriggerType } from 'acine-proto-dist';
import Edge from '../Edge';
import { MultiDirectedGraph } from 'graphology';
import forceAtlas2 from 'graphology-layout-forceatlas2';

import { makeSet, find, union, UnionFindElement } from '@manubb/union-find';
import {
  P5CanvasInstance,
  ReactP5Wrapper,
  SketchProps,
} from '@p5-wrapper/react';
import { getImageUrl } from '../../App.state';

type MySketchProps = SketchProps & {
  nodes: Record<string, GraphNode>;
  edges: Record<string, GraphEdge>;
};

interface Position {
  x: number;
  y: number;
}

interface GraphNode extends Position {
  id: string;
  icon?: string;
  label?: string;
  subLabel?: string;
  type?: 'navigation' | 'dependency';
  adj?: Routine_Edge[];
}

interface GraphEdge extends Partial<Position> {
  id: string;
  source: string;
  target: string;
  label?: string;
}

function sketch(p5: P5CanvasInstance<MySketchProps>) {
  type NodeAttributes = GraphNode;
  type EdgeAttributes = GraphEdge;
  const graph = new MultiDirectedGraph<NodeAttributes, EdgeAttributes, {}>();
  function updatePositions(iterations: number = 50) {
    const K = 3;
    graph.forEachNode((k) => {
      graph.updateNode(
        k,
        ({ x = 0, y = 0, ...n }: Partial<NodeAttributes>) =>
          ({ ...n, x: x / K, y: y / K }) as NodeAttributes,
      );
    });
    const positions = forceAtlas2(graph, {
      iterations,
      settings: { ...forceAtlas2.inferSettings(graph), adjustSizes: true },
    });
    Object.entries(positions).forEach(([k, { x, y }]) =>
      graph.updateNode(
        k,
        (n: Partial<NodeAttributes>) =>
          ({ ...n, x: x * K, y: y * K }) as NodeAttributes,
      ),
    );
    graph.mapNodes((_, { x = 0, y = 0, adj = [] }) => {
      adj.forEach((e) => {
        const { x: x2, y: y2 } = graph.getNodeAttributes(e.to);
        graph.updateEdgeWithKey(
          e.id,
          e.u,
          e.to,
          (attr) =>
            ({
              ...attr,
              x: (x + x2) / 2,
              y: (y + y2) / 2,
            }) as GraphEdge,
        );
      });
    });
  }

  let font: object;
  p5.setup = () => {
    font = p5.loadFont(
      'http://themes.googleusercontent.com/licensed/font?kit=nlKOmF1wqcz6D96Jy0PsIA',
    );
    p5.createCanvas(400, 400, p5.WEBGL);
    p5.ortho();
    p5.textFont(font);
    p5.textSize(12);
    p5.textAlign(p5.CENTER, p5.CENTER);
  };

  p5.updateWithProps = (props: MySketchProps) => {
    if (props.nodes) {
      Object.values(props.nodes).forEach(
        (n: Omit<NodeAttributes, 'x' | 'y'>) => {
          graph.updateNode(n.id, (attr: Partial<NodeAttributes>) => ({
            x: Math.random() - 0.5,
            y: Math.random() - 0.5,
            ...attr,
            ...n,
          }));
        },
      );
    }
    if (props.edges) {
      Object.values(props.edges).forEach((e) => {
        graph.updateEdgeWithKey(
          e.id,
          e.source,
          e.target,
          (attr: Partial<EdgeAttributes>) => ({
            ...attr,
            ...e,
          }),
        );
      });
    }
    for (let i = 0; i < 10; ++i) updatePositions(50);
  };

  let zoom = 1;
  p5.mouseWheel = (event?: WheelEvent) => {
    if (!event) return;
    if (event?.deltaY > 0) {
      zoom /= 1.4;
    } else {
      zoom *= 1.4;
    }
  };

  let rotationY = 0;

  function drawEdge(
    x: number,
    y: number,
    x2: number,
    y2: number,
    r: number = 50,
  ) {
    x2 -= x;
    y2 -= y;
    const l = Math.hypot(x2, y2);
    if (!l) return;
    p5.push();
    p5.rotate(Math.atan2(y2, x2));
    p5.line(r / 2, 0, l - r / 2, 0);
    const p2 = l - r / 2;
    p5.triangle(p2, 0, p2 - 5, 5, p2 - 5, -5);
    p5.pop();
  }

  function drawNode({ x = 0, y = 0, adj = [] }: Partial<NodeAttributes>) {
    const D = 10;
    p5.push();
    p5.rotateX(Math.PI / 2);
    p5.fill(255);
    p5.stroke(0);
    p5.translate(x, y);
    p5.ellipse(0, 0, D, D);

    p5.push();
    // p5.translate(0, 0, -3);
    adj.forEach((e) => {
      const { x: x2, y: y2 } = graph.getNodeAttributes(e.to);
      if (!x2 || !y2) return;
      drawEdge(0, 0, x2 - x, y2 - y, D);

      if (
        e.trigger !== Routine_Edge_EdgeTriggerType.EDGE_TRIGGER_TYPE_SCHEDULED
      ) {
        return;
      }
      const dz = 100;
      p5.translate((x2 - x) / 2, (y2 - y) / 2, dz);
      p5.fill(255);
      p5.ellipse(0, 0, D, D);
      p5.push();
      p5.rotateX(Math.PI / 2);
      for (let i = 1; i <= 10; i += 2) {
        p5.line(0, -dz * (i / 10), 0, -dz * ((i + 1) / 10));
      }
      p5.pop();
      e.dependencies.forEach((d) => {
        const { x, y } = graph.getEdgeAttributes(e.id);
        const { x: x2, y: y2 } = graph.getEdgeAttributes(d.requires);
        if (x && x2 && y && y2) drawEdge(0, 0, x2 - x, y2 - y, D);
      });

      p5.fill(0);
      p5.rotateX(-Math.PI / 2);
      p5.rotateY(-rotationY);
      // p5.text(getEdgeDisplay(e), 0, -6);
    });
    p5.pop();

    p5.rotateX(-Math.PI / 2);
    p5.rotateY(-rotationY);
    p5.fill(0);
    // p5.text(label, 0, -6);
    p5.pop();
  }

  p5.draw = () => {
    // updatePositions(5);
    p5.background(0, 0, 0, 0);
    p5.normalMaterial();
    p5.noStroke();
    p5.push();
    p5.scale(zoom);
    p5.rotateX(-0.6);
    // p5.rotateY((rotationY = rotation + (p5.mouseX * Math.PI) / 180));
    p5.rotateY((rotationY = p5.frameCount / 180));
    graph.mapNodes((_, a) => drawNode(a));
    p5.pop();
  };
}

/**
 * laggy way to render it (has broken edges bug too)
 */
export default function DependencyGraphViewer() {
  const routine = useStore($routine);
  const dnodes = useStore($nodes);

  const [selectedNode, _setSelectedNode] = useState<Routine_Edge | null>(null);

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
        adj: n.edges,
      } as GraphNode;
    });
  }, [routine, dnodes]);
  const edges = useCallback(() => {
    const a: Record<string, UnionFindElement> = Object.fromEntries(
      Object.keys(routine.nodes).map((k) => [k, makeSet()]),
    );
    const k0 = Object.keys(a)[0];
    const extraEdges: GraphEdge[] = [];
    Object.values(routine.nodes).forEach((n) => {
      n.edges.forEach((e) => {
        union(a[n.id], a[e.to]);
      });
    });
    for (const k in a) {
      if (find(a[k]) !== find(a[k0])) {
        union(a[k], a[k0]);
        extraEdges.push({
          source: k,
          target: k0,
          id: k + '-' + k0,
        });
      }
    }

    return [
      ...extraEdges,
      Object.values(routine.nodes).flatMap((n) =>
        n.edges.flatMap(
          (e) =>
            [
              {
                source: n.id.toString(),
                target: e.to.toString(),
                id: e.id,
                // label: getEdgeDisplay(e, true).substring(0, 16),
                // size: 3,
              },
              ...e.dependencies.map((d) => ({
                source: n.id,
                target: d.requires,
                id: d.id,
              })),
            ] as GraphEdge[],
        ),
      ),
    ];
  }, [routine]);

  return (
    <div className='relative flex w-full h-full overflow-hidden'>
      <div className='relative block w-full h-full'>
        <ReactP5Wrapper sketch={sketch} nodes={nodes()} edges={edges()} />
      </div>
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
        {selectedNode && dnodes[selectedNode.id] && (
          <Edge edge={dnodes[selectedNode.id]} />
        )}
      </div>
    </div>
  );
}
