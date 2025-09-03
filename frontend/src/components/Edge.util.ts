import { $routine } from '@/state';
import {
  InputReplay,
  Routine_Condition,
  Routine_Condition_Image,
  Routine_Edge,
  Routine_Edge_EdgeTriggerType,
} from 'acine-proto-dist';
import { exportGenerator, uuidv4 } from './util';

function displayCase(s: string | undefined): string {
  if (!s) return '';
  return s[0];
}

export function getEdgePrefix(edge: Routine_Edge): string {
  let prefix = '';
  // p for "pass", don't use t for "true" cuz "target"
  // don't use uppercase so it is phoentically distinct
  // don't use 1 for "true" because it looks like i for "image"
  prefix += displayCase(edge.precondition?.condition?.$case) || 'p';
  prefix += displayCase(edge.action?.$case) || 'ε';
  prefix += displayCase(edge.postcondition?.condition?.$case) || 'p';
  return prefix;
}

export function getEdgeDisplay(edge: Routine_Edge): string {
  const prefix = getEdgePrefix(edge);
  const destination = $routine.get().nodes[edge.to]?.name ?? '<dest not exist>';
  const desc = edge.description || destination || edge.to || '<no destination>';
  return prefix + ' ' + desc;
}

export class EdgePreset {
  static base() {
    return Routine_Edge.create({
      id: uuidv4(),
      trigger: Routine_Edge_EdgeTriggerType.EDGE_TRIGGER_TYPE_STANDARD,
      precondition: Routine_Condition.create({
        // precondition timeout sort of doesn't make sense
        // since it needed to pass before it is taken...
        delay: 0,
        interval: 0,
        timeout: 50,
      }),
      postcondition: Routine_Condition.create({
        delay: 0,
        interval: 10,
        // unset timeout (defaults to 30 seconds)

        // you probably want to use the destination node
        // default_condition since most transitions are
        // state transitions
        condition: { $case: 'auto', auto: true },
      }),
      limit: -1,
      // empty description defaults to destination node name
    });
  }

  static replay() {
    const x = EdgePreset.base();
    x.action = {
      $case: 'replay',
      replay: InputReplay.create(),
    };
    return x;
  }

  static epsilon() {
    const x = EdgePreset.base();
    x.action = undefined;
    x.precondition!.condition = {
      $case: 'target',
      target: true,
    };
    return x;
  }

  static imageEpsilon() {
    const x = EdgePreset.epsilon();
    x.precondition!.condition = {
      $case: 'image',
      image: Routine_Condition_Image.create(),
    };
    return x;
  }

  static replayRelative() {
    const x = EdgePreset.replay();
    x.precondition!.condition = {
      $case: 'image',
      image: Routine_Condition_Image.create(),
    };
    x.action = {
      $case: 'replay',
      replay: InputReplay.create({ relative: true }),
    };
    return x;
  }

  static subroutine() {
    const x = EdgePreset.base();
    x.action = {
      $case: 'subroutine',
      subroutine: '',
    };
    x.postcondition = undefined; // currently subroutine postcondition isn't implemnted
    return x;
  }
}

export const choices = exportGenerator<Routine_Edge, typeof EdgePreset>(
  EdgePreset,
  ['base', 'replay', 'epsilon', 'imageEpsilon', 'replayRelative', 'subroutine'],
);
