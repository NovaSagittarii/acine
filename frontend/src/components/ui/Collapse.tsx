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
  return (
    <div
      className={
        'relative overflow-hidden transition-all select-none ' +
        // `${isOpen ? 'max-h-[1000px]' : 'max-h-10'} ` +
        `${!isOpen && 'group hover:bg-black/5'} ` +
        className
      }
      onClick={() => !isOpen && setOpen(true)}
    >
      <div
        className={
          'absolute right-0 top-0 w-6 h-6 mx-4 flex justify-center items-center ' +
          'font-mono font-bold select-none transition-all ' +
          'group-hover:text-amber-700 hover:text-amber-700 ' +
          'border-2 border-transparent group-hover:border-black/20 hover:border-black/20 group-hover:bg-white hover:bg-white ' +
          `${isOpen && 'rotate-90'} `
        }
        onClick={() => setOpen((o) => !o)}
      >
        {'>'}
        <div className='absolute opacity-0 w-full h-64'>
          {/* make the collapse hitbox bigger */}
        </div>
      </div>
      {isOpen ? children : label}
    </div>
  );
}
