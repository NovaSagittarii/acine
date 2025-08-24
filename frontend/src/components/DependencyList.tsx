import { v4 as uuidv4 } from 'uuid';

import useForceUpdate from './useForceUpdate';
import { Routine_Dependency, Routine_RequirementType } from 'acine-proto-dist';
import Dependency from './Dependency';

interface DependencyListProps {
  dependencies: Routine_Dependency[];
}

export default function DependencyList({ dependencies }: DependencyListProps) {
  const forceUpdate = useForceUpdate();
  return (
    <div className='m-2 flex flex-col gap-2'>
      {dependencies.map((dependency, index) => (
        <Dependency key={index} dependency={dependency} />
      ))}
      <div
        className='hover:bg-amber-100 border border-black p-1'
        onClick={() => {
          const newDependency = Routine_Dependency.create({
            id: uuidv4(),
            count: 1,
            explicit: true,
            requirement: Routine_RequirementType.REQUIREMENT_TYPE_COMPLETION,
            requires: undefined,
          });
          dependencies.push(newDependency);
          forceUpdate();
        }}
      >
        New dependency
      </div>
    </div>
  );
}
