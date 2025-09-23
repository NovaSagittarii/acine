import { $routine } from '@/state';
import { Routine_Edge, Routine_Edge_EdgeTriggerType } from 'acine-proto-dist';
import { atom } from 'nanostores';

/** dependency graph nodes (scheduled edges) */
export const $nodes = atom<Record<string, Routine_Edge>>({});

$routine.listen((value, _oldValue) => {
  $nodes.set(
    Object.fromEntries(
      Object.values(value.nodes).flatMap((n) =>
        n.edges
          .filter(
            (e) =>
              e.trigger ===
              Routine_Edge_EdgeTriggerType.EDGE_TRIGGER_TYPE_SCHEDULED,
          )
          .map((e) => [e.id, e]),
      ),
    ),
  );
});
