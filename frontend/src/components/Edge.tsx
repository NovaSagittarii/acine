import {
  Event_Level,
  Event_Phase,
  Event_Result,
  Routine_Edge,
  Routine_Edge_EdgeTriggerType as TriggerType,
} from 'acine-proto-dist';

import { Selectable } from './types';
import EditableRoutineProperty from './ui/EditableRoutineProperty';
import Condition from './Condition';
import useForceUpdate from './useForceUpdate';
import { useStore } from '@nanostores/react';
import { $logs, $routine } from '@/state';
import Select from './ui/Select';
import ActionEditor from './ActionEditor';
import Collapse from './ui/Collapse';
import DependencyList from './DependencyList';
import { ScheduleList } from './Schedule';
import Node from './Node';
import { choices } from './Node.util';
import { getEdgePrefix } from './Edge.util';
import { runtimeQueueEdge } from '../App.state';
import SelectTab from './ui/SelectTab';

interface EdgeProps extends Selectable {
  edge: Routine_Edge;

  /**
   * suppress type select from appearing. use in cases where it doesn't
   * make sense to change the type
   */
  fixedType?: boolean;

  /**
   * don't collapse dependencies
   */
  showDependencies?: boolean;
}

export default function Edge({
  edge,
  selected = false,
  fixedType = false,
  showDependencies = false,
}: EdgeProps) {
  const routine = useStore($routine);
  const forceUpdate = useForceUpdate();
  const logs = useStore($logs);

  return (
    <div
      className={`flex flex-col gap-1 p-1 rounded-sm border ${selected ? 'border-amber-800' : 'border-black'} bg-white/80`}
    >
      <div className='flex gap-4 w-full items-center'>
        <div>
          to →
          <Select
            value={edge.to}
            values={Object.values(routine.nodes).map((n) => [n.name, n.id])}
            onChange={(v) => {
              edge.to = v;
            }}
          />
        </div>
        <div className='opacity-50'>{getEdgePrefix(edge)}</div>
        <EditableRoutineProperty
          object={edge}
          property={'description'}
          callback={forceUpdate}
          // className='w-full'
        />
        <div
          className='text-xs hover:bg-red-100'
          onClick={() => void runtimeQueueEdge(edge.id)}
        >
          exec
        </div>
      </div>
      <Collapse
        label={
          'destination node ' +
          (edge.to ? routine.nodes[edge.to]?.description : 'create options')
        }
      >
        {edge.to ? (
          routine.nodes[edge.to] ? (
            <Node node={routine.nodes[edge.to]}></Node>
          ) : (
            '<dest not exist>'
          )
        ) : (
          <div className='flex flex-col border rounded-sm p-1'>
            <div className='font-semibold text-lg'>Node Presets</div>
            <div className='flex gap-4'>
              {choices.map(({ name, method }, index) => (
                <div
                  key={index}
                  className='hover:bg-red-100'
                  onClick={() => {
                    const newNode = method();
                    routine.nodes[newNode.id] = newNode;
                    edge.to = newNode.id;
                    forceUpdate();
                  }}
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        )}
      </Collapse>
      {!fixedType && (
        <SelectTab
          label={<div className='opacity-50'>type</div>}
          value={edge.trigger}
          values={[
            {
              label: 'navigation',
              value: TriggerType.EDGE_TRIGGER_TYPE_STANDARD,
              tooltip:
                'Action for navigating UI. These should always work, ' +
                'and should be infinitely repeatable.',
            },
            {
              label: 'interrupt',
              value: TriggerType.EDGE_TRIGGER_TYPE_INTERRUPT,
              tooltip: 'Action to respond to expected async event.',
            },
            {
              label: 'scheduled',
              value: TriggerType.EDGE_TRIGGER_TYPE_SCHEDULED,
              tooltip:
                'Action must be explicitly scheduled (via cron or dependency).',
            },
          ]}
          onChange={(t) => {
            edge.trigger = t;
            forceUpdate();
          }}
        />
      )}
      <ActionEditor edge={edge} />
      <Collapse
        label={
          'precondition ' + (edge.precondition?.condition?.$case || 'true')
        }
      >
        <Condition condition={edge.precondition!} allowAuto />
      </Collapse>
      <Collapse
        label={
          'postcondition ' + (edge.postcondition?.condition?.$case || 'true')
        }
      >
        <Condition condition={edge.postcondition!} allowAuto />
      </Collapse>
      {edge.trigger === TriggerType.EDGE_TRIGGER_TYPE_SCHEDULED && (
        <>
          <Collapse
            label={`dependency (${edge.dependencies.length})`}
            open={showDependencies}
          >
            <DependencyList dependencies={edge.dependencies} />
          </Collapse>
          <Collapse label={`schedules (${edge.schedules.length})`}>
            <ScheduleList schedules={edge.schedules} />
          </Collapse>
        </>
      )}
      {logs.executionInfo[edge.id]?.events?.filter(
        (x) => x.level === Event_Level.LEVEL_CRITICAL,
      ) && <div className='text-red-500'>Check logs</div>}
      <Collapse label={`logs (${logs.executionInfo[edge.id]?.events.length})`}>
        <div className='flex flex-col'>
          {logs.executionInfo[edge.id]?.events.map(
            ({ archiveId, level, phase, result, timestamp }, index) => (
              <div key={index} className='flex gap-4'>
                <div className='font-mono text-sm'>
                  {timestamp?.toISOString()} {archiveId}
                </div>
                {level === Event_Level.LEVEL_CRITICAL ? (
                  <div className='text-red-500 font-bold'>!</div>
                ) : (
                  <div className='text-blue-500 font-bold'>i</div>
                )}
                <div>
                  {
                    Object.fromEntries([
                      [Event_Phase.PHASE_PRECONDITION, 'Precondition'],
                      [Event_Phase.PHASE_POSTCONDITION, 'Postcondition'],
                      [Event_Phase.PHASE_ACTION, 'Action'],
                    ])[phase]
                  }
                </div>
                <div>
                  {
                    Object.fromEntries([
                      [Event_Result.RESULT_ERROR, 'error'],
                      [Event_Result.RESULT_FAIL, 'fail'],
                      [Event_Result.RESULT_PASS, 'pass'],
                      [Event_Result.RESULT_TIMEOUT, 'timeout'],
                      [Event_Result.RESULT_UNSPECIFIED, '?'],
                    ])[result]
                  }
                </div>
              </div>
            ),
          )}
        </div>
      </Collapse>
    </div>
  );
}
