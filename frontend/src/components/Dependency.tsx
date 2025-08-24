import { Routine_Dependency, Routine_RequirementType } from 'acine-proto-dist';
import useForceUpdate from './useForceUpdate';
import NumberInput from './ui/NumberInput';
import Select from './ui/Select';

interface DependencyProps {
  dependency: Routine_Dependency;
}
export default function Dependency({ dependency }: DependencyProps) {
  const forceUpdate = useForceUpdate();
  return (
    <div className='hover:bg-amber-100 border border-black p-1 rounded-sm'>
      <NumberInput
        object={dependency}
        property={'count'}
        callback={forceUpdate}
      />
    </div>
  );
}
