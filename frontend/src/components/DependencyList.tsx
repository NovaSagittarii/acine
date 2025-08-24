import { v4 as uuidv4 } from 'uuid';

import useForceUpdate from './useForceUpdate';
import { Routine_Dependency, Routine_RequirementType } from 'acine-proto-dist';
import Dependency from './Dependency';
import { CloseButton } from './ui/Button';

interface DependencyListProps {
  dependencies: Routine_Dependency[];
}

export default function DependencyList({ dependencies }: DependencyListProps) {
  const forceUpdate = useForceUpdate();
  return (
    <div className='m-2 flex flex-col gap-2'>
      {dependencies.map((dependency, index) => (
        <div className='relative' key={index}>
          <Dependency dependency={dependency} />
          <CloseButton
            onClick={() => {
              dependencies.splice(index, 1);
              forceUpdate();
            }}
          />
        </div>
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
