import { ReactNode } from 'react';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

/**
 * Simple fullscreen modal with autoclose when clicking off of it.
 */
export default function Modal({ isOpen, onClose, children }: ModalProps) {
  return (
    isOpen && (
      <div className='absolute left-0 top-0 w-screen h-screen z-20'>
        <div
          className='absolute w-full h-full bg-black/10'
          onClick={() => onClose()}
        ></div>
        <div className='relative flex w-full h-full pointer-events-none'>
          {children}
        </div>
      </div>
    )
  );
}
