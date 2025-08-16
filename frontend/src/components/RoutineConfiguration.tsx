import { useStore } from '@nanostores/react';
import { $routine } from '@/state';
import EditableRoutineProperty from './ui/EditableRoutineProperty';
import useForceUpdate from './useForceUpdate';

export default function RoutineConfiguration() {
  const forceUpdate = useForceUpdate();
  const routine = useStore($routine);

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
      />
      <EditableRoutineProperty
        object={routine}
        property={'windowName'}
        callback={forceUpdate}
      />
    </div>
  );
}
