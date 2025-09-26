import React, { useEffect, useState } from 'react';
import Section from './Section';

interface SelectTabEntry<T> {
  value: T;
  label: string;
  children?: React.ReactNode;

  /** tooltip that appears on hover. TODO: use a library. */
  tooltip?: string;
}

interface SelectTabProps<T> {
  className?: string;

  /** current displayed value (this is a controlled element) */
  value: T;

  /** list of options; an option consists of [display, value] */
  values: SelectTabEntry<T>[];

  /** calls onChange with the [value] of the selected item  */
  onChange: (newValue: T) => void;

  /** display to left of tab options */
  label?: React.ReactNode;

  children?: React.ReactNode;
}

/**
 * Horizontal tabs select UI element.
 */
export default function SelectTab<T>({
  label,
  value,
  values,
  children,
  onChange,
}: SelectTabProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState(-1);
  useEffect(() => {
    if (value === undefined) setSelectedIndex(-1);
    else if (!values[selectedIndex] || values[selectedIndex].value !== value) {
      setSelectedIndex(values.findIndex((x) => x.value === value));
    }
  }, [value, values, selectedIndex, setSelectedIndex]);

  return (
    <Section.h1 className='flex-col'>
      <div className='flex flex-col'>
        <div className='flex items-center gap-1'>
          {label}
          {values.map(({ value, label, tooltip }, index) => (
            <div
              onClick={() => {
                onChange(value);
                setSelectedIndex(index);
              }}
              className={
                `p-1 rounded-sm transition-colors ` +
                `${index === selectedIndex ? 'bg-amber-100' : 'bg-black/5'} ` +
                `border ${index === selectedIndex ? 'border-amber-500' : 'border-transparent hover:border-amber-500/50'}`
              }
              title={tooltip}
            >
              {label}
            </div>
          ))}
        </div>
        {selectedIndex >= 0 && values[selectedIndex].children}
      </div>
      {children}
    </Section.h1>
  );
}
