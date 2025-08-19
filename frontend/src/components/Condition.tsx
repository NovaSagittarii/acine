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
import { $condition } from './ConditionImageEditor.state';
import { pluralize } from '../client/util';

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
  allowAuto?: boolean; // whether auto is an option
}

export default function Condition({
  condition,
  allowAuto = false,
}: ConditionProps) {
  const forceUpdate = useForceUpdate();

  return (
    <div className='pl-1 border border-black'>
      {condition.condition?.$case === 'image' && (
        <div className='float-right flex gap-2 items-center font-sans'>
          <div
            className={
              'text-sm ' +
              `${!condition.condition.image.regions.length && 'text-red-500 font-bold'}`
            }
          >
            {pluralize(condition.condition.image.regions.length, 'region')}
          </div>
          <Button
            className='px-1.5! py-0! w-fit bg-black text-white scale-100!'
            onClick={() => {
              // duplicate conditional to make typescript happy
              if (condition.condition?.$case === 'image') {
                $condition.set(condition.condition?.image);
              }
            }}
          >
            edit
          </Button>
        </div>
      )}

      {/* maybe a bit messy, but keeps it compact (only the properties matter) */}
      {/* <ConditionNumberInput c={condition} cb={forceUpdate} p='timeout' /> */}
      {/* <ConditionNumberInput c={condition} cb={forceUpdate} p='delay' /> */}
      {/* <ConditionNumberInput c={condition} cb={forceUpdate} p='interval' /> */}
      <div>
        <SelectAuto
          value={(() => {
            if (!condition.condition) return 0; // undefined
            if (condition.condition.$case === 'image') return 1;
            if (condition.condition.$case === 'text') return 2;
            if (condition.condition.$case === 'auto') return 3;
            if (condition.condition.$case === 'target') return 4;
            return -1;
          })()}
          values={
            [
              'true',
              'image',
              'text',
              allowAuto ? 'auto' : null,
              allowAuto ? 'target' : null,
            ].filter((x) => x) as (
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
              case 'auto':
                condition.condition = {
                  $case: 'auto',
                  auto: true,
                };
                break;
              case 'target':
                condition.condition = {
                  $case: 'target',
                  target: true,
                };
                break;
            }
            forceUpdate();
          }}
        />
        <span className='opacity-50'>: condition</span>
      </div>
    </div>
  );
}
