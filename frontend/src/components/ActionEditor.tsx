import { Point, Routine_Edge } from 'acine-proto-dist';
import useForceUpdate from './useForceUpdate';
import Select from './ui/Select';
import NumberInput from './ui/NumberInput';

const ACTION_TYPES_DISPLAY = [
  ['𝜀', null],
  ['click', 'click'],
  ['subroutine', 'subroutine'],
] as [string, Exclude<Routine_Edge['action'], undefined>['$case']][];

interface ActionEditorProps {
  edge: Routine_Edge;
}

export default function ActionEditor({ edge }: ActionEditorProps) {
  const forceUpdate = useForceUpdate();

  return (
    <div className='font-mono'>
      <NumberInput
        className='min-w-8 w-fit'
        object={edge}
        property={'limit'}
        label={'limit'}
        callback={forceUpdate}
        format={(x) => (x > 0 ? x.toString() : x < 0 ? 'INF' : 'disabled')}
      />
      <div>
        <Select
          value={
            !edge.action
              ? 0
              : ACTION_TYPES_DISPLAY.map((s) => s[0]).indexOf(
                  edge.action?.$case!,
                )
          }
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
                case 'subroutine':
                  edge.action = {
                    $case: v,
                    subroutine: 0,
                  };
                  break;
              }
            }
            forceUpdate();
          }}
        />
        <span className='opacity-50'>: action_type</span>
      </div>
    </div>
  );
}
