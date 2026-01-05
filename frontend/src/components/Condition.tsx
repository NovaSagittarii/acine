import {
  Routine_Condition,
  Routine_Condition_Image,
  Routine_Condition_Text,
} from 'acine-proto-dist';

import { Selectable } from './types';
import NumberInput from './ui/NumberInput';
import useForceUpdate from './useForceUpdate';
import Button from './ui/Button';
import { $condition } from './ConditionImageEditor.state';
import { pluralize } from '../client/util';
import SelectTab from './ui/SelectTab';

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
    <div className='flex flex-col'>
      <SelectTab
        label={<div className='opacity-50'>condition</div>}
        value={condition.condition?.$case}
        values={[
          { label: 'true', value: undefined, tooltip: 'Always can take.' },
          {
            label: 'image',
            value: 'image',
            tooltip: 'Look for image in frame (cv2.matchTemplate).',
          },
          {
            label: 'text',
            value: 'text',
            tooltip: 'Look for text in frame (OCR).',
          },
          {
            label: '*auto', // * marks "require allowAuto"
            value: 'auto',
            tooltip: 'Legacy: Inherit source/target default condition.',
          },
          {
            label: '*target', // * marks "require allowAuto"
            value: 'target',
            tooltip: "Inherit target node's default condition",
          },
        ].filter(({ label }) => allowAuto || !label.includes('*'))}
        onChange={(s) => {
          switch (s) {
            case undefined:
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
      >
        {/* maybe a bit messy, but keeps it compact (only the properties matter) */}
        <ConditionNumberInput c={condition} cb={forceUpdate} p='timeout' />
        {/* <ConditionNumberInput c={condition} cb={forceUpdate} p='delay' /> */}
        {/* <ConditionNumberInput c={condition} cb={forceUpdate} p='interval' /> */}

        {condition.condition?.$case === 'image' && (
          <div className='flex gap-2 items-center font-sans'>
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
      </SelectTab>
    </div>
  );
}

export function ConditionDescription({
  condition,
}: {
  condition: Routine_Condition;
}) {
  if (!condition.condition) return <span>true</span>;
  const { $case } = condition.condition;
  switch ($case) {
    case 'image':
      const { image } = condition.condition;
      return <span>image {image.regions.length}</span>;
    default:
      return <span>{$case}</span>;
  }
}
