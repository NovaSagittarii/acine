import { $routine } from '@/state';
import { Routine_Edge } from 'acine-proto-dist';

export function getEdgeDisplay(edge: Routine_Edge): string {
  const destination = $routine.get().nodes.find((n) => n.id === edge.to)?.name;
  return edge.description || destination || edge.to || '<no destination>';
}
