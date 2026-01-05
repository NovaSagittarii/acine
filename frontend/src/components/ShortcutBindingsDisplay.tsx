import { useStore } from '@nanostores/react';
import { $bindings, KeyCode } from './useShortcut';

const KeycodeDisplay: Partial<Record<KeyCode, string>> = {
  Backquote: '`',
  BracketLeft: '[',
  BracketRight: ']',
  Escape: 'ESC',
  Delete: 'DEL',
  Enter: '↵',
};

function renderKeycode(key: KeyCode): string {
  if (key.startsWith('Key')) return key.substring(3);
  if (key.startsWith('Digit')) return key.substring(5);
  return KeycodeDisplay[key] || key;
}

export default function ShortcutBindingsDisplay() {
  const bindings = useStore($bindings);
  return (
    <>
      {Object.entries(bindings)
        .filter(([_k, v]) => v && !v.hidden)
        .sort()
        .map(([k, v]) => {
          if (!v) return <></>;
          const { label } = v;
          k = renderKeycode(k as KeyCode);
          return (
            <div className='flex gap-2 text-xs' key={k}>
              <div className='font-mono min-w-4 min-h-4 px-1 border border-black rounded-sm text-center'>
                {k}
              </div>
              <div>{label}</div>
            </div>
          );
        })}
    </>
  );
}
