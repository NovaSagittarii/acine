import { useStore } from '@nanostores/react';
import { $logs } from '@/state';
import { Event, Action_Phase, Action_Result } from 'acine-proto-dist';
import { getArchiveUrl } from '../App.state';
import { getKey } from './util';

function Log({ event }: { event: Event }) {
  const { timeStart, timeEnd, context, action, debug } = event;
  return (
    <div className='relative flex flex-col border-x border-black w-full'>
      <div className='sticky top-0 z-1 bg-white border-t border-black'>
        <div className='relative flex items-center w-full gap-4'>
          <div className='absolute top-1 right-1 text-xs font-mono'>
            {timeStart?.toLocaleString()}
          </div>
          <div className='font-mono'>
            {context?.currentNode?.id}
            {' => '}
            {context?.targetNode?.id}
          </div>
        </div>
      </div>
      {action?.events.map(({ archiveId, phase, timestamp }, index) => (
        <div className='relative flex items-center gap-2' key={index}>
          <div className='absolute top-1 right-1 text-xs font-mono'>
            {timestamp?.toLocaleString()}
          </div>
          {archiveId && (
            <img
              loading='lazy'
              src={getArchiveUrl(archiveId)}
              className='w-auto h-auto max-h-24 max-w-24'
            />
          )}
          {getKey(Action_Phase, phase)}
        </div>
      ))}
      <div className='sticky bottom-0 z-1 bg-white border-b border-black'>
        <div className='relative flex items-center w-full gap-4'>
          <div className='absolute top-1 right-1 text-xs font-mono'>
            {debug?.comment && debug?.comment + '; '}
            {timeEnd?.toLocaleString()}
          </div>
          <div className='font-mono text-sm opacity-50 flex gap-4'>
            <div>{action && `take_edge=${action.id}`}</div>
            <div>{action && getKey(Action_Result, action.result)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LogsDisplay() {
  const logs = useStore($logs);

  return (
    <div className='h-full flex flex-col gap-1 overflow-y-auto grow'>
      {logs.events.map((event, index) => (
        <Log event={event} key={index} />
      ))}
    </div>
  );
}
