import { Routine } from 'acine-proto-dist';
import SchedulingGroup from '../SchedulingGroup';
import Edge from '../Edge';
import Collapse from '../ui/Collapse';

interface ScheduleViewerProps {
  routine: Routine;
}
export default function ScheduleViewer({ routine }: ScheduleViewerProps) {
  return (
    <div className='w-full max-h-full pl-2 py-2 overflow-hidden flex flex-col'>
      <div className='max-h-full overflow-y-auto flex flex-col gap-2'>
        {Object.values(routine.sgroups).map((sg) => (
          <div
            key={sg.id}
            className='flex flex-col gap-2 p-2 rounded-sm border border-black'
          >
            <SchedulingGroup schedulingGroup={sg} />
            <Collapse label={<p className='font-bold text-lg'>Linked</p>} open>
              {Object.values(routine.nodes)
                .flatMap((n) => n.edges)
                .filter(
                  (e) =>
                    e.schedules.findIndex(
                      (s) => s.schedulingGroupId === sg.id,
                    ) >= 0,
                )
                .map((e) => (
                  <Edge edge={e} fixedType />
                ))}
            </Collapse>
          </div>
        ))}
      </div>
    </div>
  );
}
