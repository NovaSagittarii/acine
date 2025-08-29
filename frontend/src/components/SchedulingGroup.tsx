import {
  Routine_SchedulingGroup,
  Routine_SchedulingGroup_Period as Period,
} from 'acine-proto-dist';
import EditableRoutineProperty from './ui/EditableRoutineProperty';
import useForceUpdate from './useForceUpdate';
import Select from './ui/Select';
import { PERIOD_DISPLAY } from './display';
import NumberInput from './ui/NumberInput';
import ElementList from './ElementList';

import dayjs from 'dayjs';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';

interface SchedulingGroupProps {
  schedulingGroup: Routine_SchedulingGroup;
}
export default function SchedulingGroup({
  schedulingGroup: sgroup,
}: SchedulingGroupProps) {
  const forceUpdate = useForceUpdate();
  return (
    <div>
      <EditableRoutineProperty
        object={sgroup}
        property={'name'}
        callback={forceUpdate}
      />
      <EditableRoutineProperty
        object={sgroup}
        property={'description'}
        callback={forceUpdate}
      />
      <div className='flex flex-col'>
        <div className='flex w-full gap-4'>
          <Select
            value={sgroup.periodPreset}
            values={PERIOD_DISPLAY}
            onChange={(v) => {
              sgroup.periodPreset = v;
              forceUpdate();
            }}
          />
          {sgroup.periodPreset === Period.PERIOD_UNSPECIFIED && (
            <div>
              <NumberInput
                object={sgroup}
                property={'period'}
                callback={forceUpdate}
              />
            </div>
          )}
        </div>
        <ElementList
          unit={'dispatch time'}
          elements={sgroup.dispatchTimes}
          createElement={() => 0}
          onUpdate={forceUpdate}
          render={(x, i) => (
            <div key={i} className='flex flex-wrap items-center gap-4'>
              {x}
              <LocalizationProvider dateAdapter={AdapterDayjs}>
                <TimePicker
                  views={['hours', 'minutes', 'seconds']}
                  value={dayjs(x * 1000)}
                  onChange={(v) => {
                    if (v) {
                      const t = (v.unix() + 86400) % 86400;
                      sgroup.dispatchTimes[i] = t;
                      forceUpdate();
                    }
                  }}
                />
              </LocalizationProvider>
              <NumberInput
                object={sgroup.dispatchTimes}
                property={i}
                callback={forceUpdate}
                label='seconds'
              />
            </div>
          )}
        />
      </div>
    </div>
  );
}
