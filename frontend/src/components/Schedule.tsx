import {
  Routine_Edge_ScheduleInstance,
  Routine_SchedulingGroup,
  Routine_SchedulingGroup_Period as Period,
  Routine_RequirementType,
} from 'acine-proto-dist';
import { v4 as uuidv4 } from 'uuid';

import useForceUpdate from './useForceUpdate';
import ElementList from './ElementList';
import NumberInput from './ui/NumberInput';
import { REQUIREMENT_TYPE_DISPLAY } from './display';
import Select from './ui/Select';
import { useStore } from '@nanostores/react';
import { $routine } from '@/state';
import SchedulingGroup from './SchedulingGroup';

interface ScheduleProps {
  schedule: Routine_Edge_ScheduleInstance;
}

export default function Schedule({ schedule }: ScheduleProps) {
  const routine = useStore($routine);
  const forceUpdate = useForceUpdate();
  return (
    <div>
      <NumberInput
        object={schedule}
        property={'count'}
        callback={forceUpdate}
        label='count'
      />
      <Select
        label={'Requirement Type'}
        value={schedule.requirement}
        values={REQUIREMENT_TYPE_DISPLAY}
        onChange={(v) => {
          schedule.requirement = v;
        }}
      />
      <div>
        <Select
          label={'Group'}
          value={schedule.schedulingGroupId}
          values={Object.values(routine.sgroups).map((sg) => [sg.name, sg.id])}
          onChange={(v) => (schedule.schedulingGroupId = v)}
        />
        {routine.sgroups[schedule.schedulingGroupId] ? (
          <SchedulingGroup
            schedulingGroup={routine.sgroups[schedule.schedulingGroupId]}
          />
        ) : (
          <div
            className='p-1 border border-black hover:bg-amber-100'
            onClick={() => {
              const newGroup = Routine_SchedulingGroup.create({
                id: uuidv4(),
                name: 'Daily 12AM UTC',
                deadline: 86400,
                periodPreset: Period.PERIOD_DAILY,
              });
              schedule.schedulingGroupId = newGroup.id;
              routine.sgroups[newGroup.id] = newGroup;
              forceUpdate();
            }}
          >
            New scheduling group
          </div>
        )}
      </div>
    </div>
  );
}

interface ScheduleListProps {
  schedules: Routine_Edge_ScheduleInstance[];
}

export function ScheduleList({ schedules }: ScheduleListProps) {
  const forceUpdate = useForceUpdate();
  return (
    <ElementList
      unit='schedule'
      elements={schedules}
      createElement={() =>
        Routine_Edge_ScheduleInstance.create({
          count: 1,
          requirement: Routine_RequirementType.REQUIREMENT_TYPE_COMPLETION,
        })
      }
      onUpdate={forceUpdate}
      render={(w) => <Schedule schedule={w} />}
    />
  );
}
