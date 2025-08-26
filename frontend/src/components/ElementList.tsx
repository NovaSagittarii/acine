import { CloseButton } from './ui/Button';

interface ElementListProps<T> {
  unit?: string | undefined;
  elements: T[];
  createElement: () => T;
  onUpdate: () => void;
  render: (element: T, index: number) => React.ReactNode;
}

/**
 * Displays a generic list of items.
 */
export default function ElementList<T>({
  unit,
  elements,
  createElement,
  onUpdate,
  render,
}: ElementListProps<T>) {
  return (
    <div className='m-2 flex flex-col gap-2'>
      {elements.map((element, index) => (
        <div
          key={index}
          className='relative border border-black p-1 rounded-sm'
        >
          {render(element, index)}
          <CloseButton
            onClick={() => {
              elements.splice(index, 1);
              onUpdate();
            }}
          />
        </div>
      ))}
      <div
        className='hover:bg-amber-100 border border-black p-1'
        onClick={() => {
          elements.push(createElement());
          onUpdate();
        }}
      >
        {unit ? `New ${unit}` : 'New'}
      </div>
    </div>
  );
}
