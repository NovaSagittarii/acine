import { InputReplay, Point, Routine_Edge } from 'acine-proto-dist';
import useForceUpdate from './useForceUpdate';
import Select from './ui/Select';
import ReplayEditor from './ReplayEditor';
import SubroutineEditor from './SubroutineEditor';
import NumberInput from './ui/NumberInput';
import { displayRepeatRange } from './ActionEditor.util';

const ACTION_TYPES_DISPLAY = [
  ['𝜀', null],
  ['click', 'click'],
  ['replay', 'replay'],
  ['subroutine', 'subroutine'],
] as [string, Exclude<Routine_Edge['action'], undefined>['$case']][];

interface ActionEditorProps {
  edge: Routine_Edge;
}

export default function ActionEditor({ edge }: ActionEditorProps) {
  const forceUpdate = useForceUpdate();

  return (
    <div className=''>
      <div className='flex gap-4'>
        <NumberInput
          className='min-w-8 w-fit'
          object={edge}
          property={'repeatLower'}
          label={'repeat'}
          callback={forceUpdate}
        />
        <NumberInput
          className='min-w-8 w-fit'
          object={edge}
          property={'repeatUpper'}
          label={'limit'}
          callback={forceUpdate}
        />
        <div className='px-2 flex items-center gap-2 bg-green-100'>
          {'runs ' + displayRepeatRange(edge.repeatLower, edge.repeatUpper)}
        </div>
      </div>
      <div>
        <Select
          value={edge.action?.$case || null}
          values={ACTION_TYPES_DISPLAY}
          onChange={(v) => {
            if (v === null) {
              edge.action = undefined;
            } else {
              switch (v) {
                case 'click':
                  edge.action = {
                    $case: v,
                    click: Point.create(),
                  };
                  break;
                case 'replay':
                  edge.action = {
                    $case: v,
                    replay: InputReplay.create(),
                  };
                  break;
                case 'subroutine':
                  edge.action = {
                    $case: v,
                    subroutine: '',
                  };
                  break;
              }
            }
            forceUpdate();
          }}
        />
        <span className='opacity-50'>: action_type</span>
      </div>
      {edge.action?.$case === 'subroutine' && (
        <SubroutineEditor action={edge.action} />
      )}
      {edge.action?.$case === 'replay' && (
        <ReplayEditor
          replay={edge.action.replay}
          condition={edge.precondition}
        />
      )}
    </div>
  );
}
