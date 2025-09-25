import { useState } from 'react';

interface CollapseProps {
  className?: string;
  label: React.ReactNode;
  children: React.ReactNode;

  /** whether to keep it automatically open; by default is closed */
  open?: boolean;
}

/**
 * A collapseable region, used for saving space.
 */
export default function Collapse({
  className = '',
  label,
  children,
  open = false,
}: CollapseProps) {
  const [isOpen, setOpen] = useState(open);
  const [ref, setRef] = useState<HTMLElement | null>(null);
  return (
    <div
      className={
        'relative overflow-hidden transition-all duration-100 select-none ' +
        // `${isOpen ? 'max-h-[1000px]' : 'max-h-10'} ` +
        `${!isOpen && 'group bg-amber-900/5 hover:bg-amber-500/5'} ` +
        `${!isOpen && 'text-black/50 hover:text-black'} ` +
        `border border-transparent ${!isOpen && 'hover:border-amber-500'} ` +
        className
      }
      onClick={() => {
        if (!isOpen) {
          setOpen(true);
          ref?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }}
      ref={setRef}
    >
      <div
        className='group flex items-center'
        onClick={() => setOpen((o) => !o)}
      >
        {label}
        <div
          className={
            'absolute right-0 top-0 w-6 h-6 mx-4 flex justify-center items-center ' +
            'font-mono font-bold select-none z-10 transition-all ' +
            'group-hover:text-amber-700 hover:text-amber-700 ' +
            'border-2 border-transparent group-hover:border-black/20 hover:border-black/20 group-hover:bg-white hover:bg-white ' +
            `${isOpen && 'rotate-90'} `
          }
        >
          {'>'}
        </div>
      </div>
      {isOpen && children}
    </div>
  );
}
