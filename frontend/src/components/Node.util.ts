import {
  Routine_Condition,
  Routine_Condition_Image,
  Routine_Node,
  Routine_Node_NodeType,
} from 'acine-proto-dist';
import { v4 as uuidv4 } from 'uuid';

export class NodePreset {
  static base() {
    return Routine_Node.create({
      id: uuidv4(),
      name: 'unnamed node',
      type: Routine_Node_NodeType.NODE_TYPE_STANDARD,
      defaultCondition: Routine_Condition.create({
        delay: 50,
        interval: 100,
      }),
    });
  }
  static image() {
    const n = NodePreset.base();
    n.defaultCondition!.condition = {
      $case: 'image',
      image: Routine_Condition_Image.create(),
    };
    return n;
  }
}

interface NodePresetDescription {
  name: string;
  method: () => Routine_Node;
}

export const choices = (['base', 'image'] as (keyof NodePreset)[]).map(
  (x) => ({ name: x, method: NodePreset[x] }) as NodePresetDescription,
);
