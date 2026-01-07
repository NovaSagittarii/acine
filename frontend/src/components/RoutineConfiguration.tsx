import { useStore } from '@nanostores/react';
import { $backendConfiguration, $routine, $sourceDimensions } from '@/state';
import EditableRoutineProperty from './ui/EditableRoutineProperty';
import useForceUpdate from './useForceUpdate';
import { $timeSpent } from '../activity';
import { formatDuration } from '../client/util';
import LogsDisplay from './LogsDisplay';
import Annotation from './ui/Annotation';
import Button from './ui/Button';
import { SelectAuto } from './ui/Select';
import { getWindowSize } from '../App.state';

export default function RoutineConfiguration() {
  const forceUpdate = useForceUpdate();
  const routine = useStore($routine);
  const backendConfiguration = useStore($backendConfiguration);
  const timeSpent = useStore($timeSpent);

  return (
    <div className='flex flex-col gap-1 p-4 w-full h-full'>
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
      {routine.launchConfig && (
        <>
          <EditableRoutineProperty
            object={routine.launchConfig}
            property={'startCommand'}
            callback={forceUpdate}
            className='font-mono'
          />
          <Annotation label='startCommand presets'>
            <SelectAuto
              className='pl-4'
              value={routine.launchConfig.startCommand}
              values={backendConfiguration.startCommands}
              onChange={(x) => {
                routine.launchConfig!.startCommand = x;
                forceUpdate();
              }}
            />
          </Annotation>
          <EditableRoutineProperty
            object={routine.launchConfig}
            property={'windowName'}
            callback={forceUpdate}
            className='font-mono'
          />
          <Annotation label='resolution'>
            <div className='flex'>
              {routine.launchConfig.width}x{routine.launchConfig.height}
              <Button
                variant='minimal'
                className='hover:bg-amber-100'
                onClick={async () => {
                  const pos = await getWindowSize();
                  console.log($sourceDimensions.get(), pos);
                  routine.launchConfig!.width = pos.width;
                  routine.launchConfig!.height = pos.height;
                  forceUpdate();
                }}
              >
                set
              </Button>
            </div>
          </Annotation>
        </>
      )}
      Time Spent: {formatDuration(timeSpent)}
      <LogsDisplay />
    </div>
  );
}
