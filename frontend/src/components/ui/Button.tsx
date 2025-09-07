import { useEffect, useState } from 'react';

interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void | Promise<void>;
  hotkey?: string;
}

export default function Button({
  children,
  className = '',
  hotkey,
  onClick = () => {},
}: ButtonProps) {
  const [isDown, setDown] = useState(false);
  useEffect(() => {
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
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('keyup', onKeyUp);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('keyup', onKeyUp);
    };
  }, [hotkey, onClick]);
  return (
    <div
      onClick={() => void onClick()}
      className={
        'p-3 rounded-lg text-center transition-colors select-none ' +
        `border-4 ${!isDown ? 'border-transparent' : 'border-sky-500'} hover:border-blue-500 ` +
        className
      }
    >
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
