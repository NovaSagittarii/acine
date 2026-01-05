import { useStore } from '@nanostores/react';
import { $bindings } from './useShortcut';

export default function ShortcutBindingsDisplay() {
  const bindings = useStore($bindings);
  return (
    <>
      {Object.entries(bindings)
        .filter(([_k, v]) => v)
        .sort()
        .map(([k, v]) => {
          if (!v) return <></>;
          const { label } = v;
          return (
            <div className='flex gap-2 text-xs' key={k}>
              <div className='font-mono min-w-4 min-h-4 border border-black rounded-sm'>
                {k}
              </div>
              <div>{label}</div>
            </div>
          );
        })}
    </>
  );
}
