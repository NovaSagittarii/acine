import React, { useId } from 'react';
// import { Tooltip } from 'react-tooltip';

interface AnnotationProps {
  children: React.ReactNode;
  label?: string;
  tooltip?: React.ReactNode;
}

export default function Annotation({
  children,
  label,
  // tooltip,
}: AnnotationProps) {
  const id = useId().replace(/:/g, '');
  return label ? (
    <div className='group relative'>
      {children}
      <div
        className='absolute top-0 left-1 translate-y-[0%] group-hover:translate-y-[-50%] text-xs opacity-10 group-hover:opacity-50 transition-all'
        id={id}
      >
        {label}
      </div>
      {/* {tooltip && (
        <Tooltip key={'tooltip-' + id} anchorSelect={'#' + id} place='top'>
          {tooltip}
        </Tooltip>
      )} */}
    </div>
  ) : (
    children
  );
}
