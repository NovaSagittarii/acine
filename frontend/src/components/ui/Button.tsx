import { useState } from 'react';
import useShortcut, { KeyCode } from '../useShortcut';

interface ModifierKeys {
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}

interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: (modifiers: ModifierKeys) => void | Promise<void>;
  shortcut?: KeyCode | null | false;
  shortcutLabel?: Exclude<string, ''> | undefined;
  hideShortcut?: boolean;
  variant?: 'standard' | 'minimal';
  compact?: boolean; // disallow adding text on side? (expands box)
}

export default function Button({
  children,
  className = '',
  shortcut = null,
  shortcutLabel,
  hideShortcut = false,
  variant = 'standard',
  compact = false,
  onClick = (_modifiers: ModifierKeys) => {},
}: ButtonProps) {
  const [isDown, setDown] = useState(false);
  useShortcut(shortcut, {
    label:
      shortcutLabel ||
      (typeof children === 'string' ? children : 'Press button'),
    onKeyDown: (ev?: KeyboardEvent) => {
      if (ev && ev.code === shortcut && !isDown.valueOf()) {
        setDown(true);
        const { shiftKey, altKey, ctrlKey, metaKey } = ev;
        void onClick({ shiftKey, altKey, ctrlKey, metaKey });
      }
    },
    onKeyUp: (ev?: KeyboardEvent) => {
      if (ev && ev.code === shortcut) {
        setDown(false);
      }
    },
    hidden: hideShortcut,
  });
  return (
    <div
      onClick={({ shiftKey, altKey, ctrlKey, metaKey }) =>
        void onClick({ shiftKey, altKey, ctrlKey, metaKey })
      }
      className={
        (variant === 'standard'
          ? 'p-3 rounded-lg text-center transition-colors select-none ' +
            `border-4 ${!isDown ? 'border-transparent' : 'border-sky-500'} hover:border-blue-500 `
          : '') + className
      }
    >
      <div className='flex justify-center items-center relative'>
        {children}
        {shortcut && (
          <span
            className={
              'text-xs font-mono p-1 ' +
              (compact &&
                'absolute right-0 top-0 translate-x-[50%] translate-y-[-30%]')
            }
          >
            {shortcut}
          </span>
        )}
      </div>
    </div>
  );
}

export function CloseButton({
  onClick = () => {},
  shortcut = null,
  shortcutLabel = '',
}: Pick<ButtonProps, 'onClick' | 'shortcut' | 'shortcutLabel'>) {
  return (
    <Button
      variant='minimal'
      shortcut={shortcut}
      shortcutLabel={shortcutLabel}
      onClick={({ shiftKey, altKey, ctrlKey, metaKey }) =>
        void onClick({ shiftKey, altKey, ctrlKey, metaKey })
      }
      className={
        'm-4 w-8 h-8 flex items-center justify-center absolute top-0 right-0 ' +
        'font-mono text-red-500 border border-red-500 rounded-sm ' +
        'hover:border-2 ' +
        'opacity-50 hover:opacity-100 transition-opacity'
      }
    >
      x
    </Button>
  );
}
