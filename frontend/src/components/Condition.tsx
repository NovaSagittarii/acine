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

interface ConditionNumberInputProps<K extends keyof Routine_Condition> {
  /* property */
  p: K;
  /*condition */
  c: Routine_Condition;
  /* callback */
  cb: () => void;
}
function ConditionNumberInput<K extends keyof Routine_Condition>({
  p: property,
  c: condition,
  cb: callback,
}: ConditionNumberInputProps<K>) {
  return (
    <NumberInput
      label={property}
      object={condition}
      property={property}
      callback={callback}
    />
  );
}

interface ConditionProps extends Selectable {
  condition: Routine_Condition;
}

export default function Condition({ condition }: ConditionProps) {
  const forceUpdate = useForceUpdate();

  return (
    <div className='pl-1 border border-black font-mono'>
      {/* maybe a bit messy, but keeps it compact (only the properties matter) */}
      <ConditionNumberInput c={condition} cb={forceUpdate} p='timeout' />
      <ConditionNumberInput c={condition} cb={forceUpdate} p='delay' />
      <ConditionNumberInput c={condition} cb={forceUpdate} p='interval' />
      <div>
        <SelectAuto
          value={(() => {
            if (!condition.condition) return 0; // undefined
            if (condition.condition.$case === 'image') return 1;
            return -1;
          })()}
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
