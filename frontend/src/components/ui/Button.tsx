interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void | Promise<void>;
}

export default function Button({
  children,
  className = '',
  onClick = () => {},
}: ButtonProps) {
  return (
    <div
      onClick={() => void onClick()}
      className={
        'p-4 rounded-lg text-center hover:scale-105 active:scale-95 transition-transform select-none ' +
        className
      }
    >
      {children}
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
        'opacity-50 hover:opacity-100 transition-opacity'
      }
    >
      x
    </div>
  );
}
