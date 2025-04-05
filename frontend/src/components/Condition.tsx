import {
  Routine_Condition,
  Routine_Condition_Image,
  Routine_Condition_Text,
} from 'acine-proto-dist';

import { Selectable } from './types';
import NumberInput from './ui/NumberInput';
import useForceUpdate from './useForceUpdate';
import { SelectAuto } from './ui/Select';
import Button from './ui/Button';
import { $condition } from './ConditionImageEditor';

interface ConditionProps extends Selectable {
  condition: Routine_Condition;
}

export default function Condition({ condition }: ConditionProps) {
  const forceUpdate = useForceUpdate();

  function ScopedNumberInput<K extends keyof Routine_Condition>({
    property,
  }: {
    property: K;
  }) {
    return (
      <NumberInput
        label={property}
        object={condition}
        property={property}
        callback={forceUpdate}
      />
    );
  }

  return (
    <div className='pl-1 border border-black font-mono'>
      <ScopedNumberInput property='timeout' />
      <ScopedNumberInput property='delay' />
      <ScopedNumberInput property='interval' />
      <div>
        <SelectAuto
          values={
            ['true', 'image' /*, 'text'*/] as (
              | Exclude<Routine_Condition['condition'], undefined>['$case']
              | 'true'
            )[]
          }
          onChange={(s) => {
            switch (s) {
              case 'true':
                condition.condition = undefined;
                break;
              case 'image':
                condition.condition = {
                  $case: 'image',
                  image: Routine_Condition_Image.create(),
                };
                break;
              case 'text':
                condition.condition = {
                  $case: 'text',
                  text: Routine_Condition_Text.create(),
                };
                break;
            }
            forceUpdate();
          }}
        />
        <span className='opacity-50'>: condition</span>
      </div>
      {condition.condition?.$case === 'image' && (
        <Button
          className='p-1! w-1/2 bg-black text-white scale-100!'
          onClick={() => {
            console.log('setters');

            // duplicate conditional to make typescript happy
            if (condition.condition?.$case === 'image') {
              $condition.set(condition.condition?.image);
            }
          }}
        >
          edit
        </Button>
      )}
    </div>
  );
}
