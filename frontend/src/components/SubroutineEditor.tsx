import { $routine } from '@/state';
import { useStore } from '@nanostores/react';
import {
  Routine_Edge,
  Routine_Node,
  Routine_Node_NodeType,
} from 'acine-proto-dist';
import { useEffect, useState } from 'react';
import Select from './ui/Select';

interface SubroutineEditorProps {
  action: NonNullable<Routine_Edge['action']>;
}

/**
 * more of a subroutine selector...
 */
export default function SubroutineEditor({ action }: SubroutineEditorProps) {
  const routine = useStore($routine);
  if (action.$case !== 'subroutine') {
    throw new Error(`invalid action type, got ${action.$case}`);
  }
  const [options, setOptions] = useState<Routine_Node[]>([]);
  useEffect(() => {
    setOptions(
      routine.nodes.filter(
        (n) => n.type & Routine_Node_NodeType.NODE_TYPE_INIT,
      ),
    );
  }, [routine.nodes]);
  return (
    <Select
      value={action.subroutine}
      values={options.map((n) => [n.name, n.id] as [string, string])}
      onChange={(id) => (action.subroutine = id)}
    />
  );
}
