import { useStore } from '@nanostores/react';
import { $routine } from '@/state';
import EditableRoutineProperty from './ui/EditableRoutineProperty';
import useForceUpdate from './useForceUpdate';
import { $timeSpent } from '../activity';
import { formatDuration } from '../client/util';

export default function RoutineConfiguration() {
  const forceUpdate = useForceUpdate();
  const routine = useStore($routine);
  const timeSpent = useStore($timeSpent);

  return (
    <div className='flex flex-col gap-4 p-4'>
      <div className='font-semibold text-2xl'>Routine Configuration</div>
      <div className='text-xs text-right'>{routine.id}</div>
      <EditableRoutineProperty
        object={routine}
        property={'name'}
        callback={forceUpdate}
      />
      <EditableRoutineProperty
        object={routine}
        property={'description'}
        callback={forceUpdate}
      />
      <EditableRoutineProperty
        object={routine}
        property={'startCommand'}
        callback={forceUpdate}
        className='font-mono'
      />
      <EditableRoutineProperty
        object={routine}
        property={'windowName'}
        callback={forceUpdate}
        className='font-mono'
      />
      Time Spent: {formatDuration(timeSpent)}
    </div>
  );
}
