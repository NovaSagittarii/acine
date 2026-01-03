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
}

export default function Button({
  children,
  className = '',
  shortcut = null,
  onClick = (_modifiers: ModifierKeys) => {},
}: ButtonProps) {
  const [isDown, setDown] = useState(false);
  function Shortcut() {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.code === shortcut && !isDown.valueOf()) {
        setDown(true);
        const { shiftKey, altKey, ctrlKey, metaKey } = ev;
        void onClick({ shiftKey, altKey, ctrlKey, metaKey });
      }
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.code === shortcut) {
        setDown(false);
      }
    };
    useShortcut(shortcut, onKeyDown, onKeyUp);
    return <></>;
  }
  return (
    <div
      onClick={({ shiftKey, altKey, ctrlKey, metaKey }) =>
        void onClick({ shiftKey, altKey, ctrlKey, metaKey })
      }
      className={
        'p-3 rounded-lg text-center transition-colors select-none ' +
        `border-4 ${!isDown ? 'border-transparent' : 'border-sky-500'} hover:border-blue-500 ` +
        className
      }
    >
      {shortcut && <Shortcut />}
      {children}
      {shortcut && `[${shortcut}]`}
    </div>
  );
}

export function CloseButton({
  onClick = () => {},
}: Pick<ButtonProps, 'onClick'>) {
  return (
    <div
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
    </div>
  );
}
