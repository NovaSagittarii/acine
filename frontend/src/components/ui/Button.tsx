import { useState } from 'react';
import useShortcut, { KeyCode } from '../useShortcut';

interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void | Promise<void>;
  hotkey?: KeyCode | null | false;
}

export default function Button({
  children,
  className = '',
  hotkey = null,
  onClick = () => {},
}: ButtonProps) {
  const [isDown, setDown] = useState(false);
  function Shortcut() {
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.code === hotkey && !isDown.valueOf()) {
        setDown(true);
        void onClick();
      }
    };
    const onKeyUp = (ev: KeyboardEvent) => {
      if (ev.code === hotkey) {
        setDown(false);
      }
    };
    useShortcut(hotkey, onKeyDown, onKeyUp);
    return <></>;
  }
  return (
    <div
      onClick={() => void onClick()}
      className={
        'p-3 rounded-lg text-center transition-colors select-none ' +
        `border-4 ${!isDown ? 'border-transparent' : 'border-sky-500'} hover:border-blue-500 ` +
        className
      }
    >
      {hotkey && <Shortcut />}
      {children}
      {hotkey && `[${hotkey}]`}
    </div>
  );
}

export function CloseButton({
  onClick = () => {},
}: Pick<ButtonProps, 'onClick'>) {
  return (
    <div
      onClick={() => void onClick()}
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
