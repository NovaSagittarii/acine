import { InputReplay, Routine_Edge } from 'acine-proto-dist';
import useForceUpdate from './useForceUpdate';
import ReplayEditor from './ReplayEditor';
import SubroutineEditor from './SubroutineEditor';
import NumberInput from './ui/NumberInput';
import { displayRepeatRange } from './ActionEditor.util';
import SelectTab from './ui/SelectTab';

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
      <SelectTab
        label={<div className='opacity-50'>action</div>}
        value={edge.action?.$case || null}
        values={[
          { label: '𝜀', value: null, tooltip: 'Do nothing.' },
          {
            label: 'replay',
            value: 'replay',
            tooltip: 'Record a sequence of actions, then replay.',
          },
          {
            label: 'subroutine',
            value: 'subroutine',
            tooltip: 'Execute subroutine.',
          },
        ]}
        onChange={(v) => {
          switch (v) {
            case null: {
              edge.action = undefined;
              break;
            }
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
        }}
      >
        {edge.action?.$case === 'subroutine' && (
          <SubroutineEditor action={edge.action} />
        )}
        {edge.action?.$case === 'replay' && (
          <ReplayEditor
            replay={edge.action.replay}
            condition={edge.precondition}
          />
        )}
      </SelectTab>
    </div>
  );
}
