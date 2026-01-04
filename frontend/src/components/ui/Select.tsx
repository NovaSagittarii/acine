import { useEffect, useRef, useState } from 'react';
import Annotation from './Annotation';

interface SelectProps<T> {
  className?: string;
  /** current displayed value (this is a controlled element) */
  value: T | undefined;

  /** list of options; an option consists of [display, value] */
  values: [string, T][];

  /** Usage hint */
  label?: string;

  /** calls onChange with the [value] of the selected item  */
  onChange: (newValue: T) => void;

  autofocus?: boolean;
  // ref?: React.RefObject<HTMLSelectElement> | null;
}

/**
 * Dropdown select UI element.
 *
 * `values` prop is in the form [displayString, actualValue]
 */
export default function Select<T>({
  value,
  values,
  label,
  onChange,
  className = '',
  autofocus = false,
}: SelectProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState(-1);

  useEffect(() => {
    if (value === undefined) setSelectedIndex(-1);
    else if (!values[selectedIndex] || values[selectedIndex][1] !== value) {
      setSelectedIndex(values.findIndex(([_, x]) => x === value));
    }
  }, [value, values, selectedIndex, setSelectedIndex]);

  const ref = useRef<HTMLSelectElement>(null);
  useEffect(() => {
    if (autofocus && ref.current) ref.current.focus();
  }, [ref, autofocus]);

  return (
    <Annotation label={label}>
      <select
        className={
          'hover:bg-black/5 hover:cursor-text transition-colors ' + className
        }
        onChange={(ev) => {
          const index = +ev.target.value; // unset placeholder
          setSelectedIndex(index);
          onChange(values[index][1]);
        }}
        value={selectedIndex.toString()}
        ref={ref}
      >
        {selectedIndex === -1 && (
          <option value='-1' disabled>
            {'<unset>'}
          </option>
        )}
        {values.map(([s, _v], i) => (
          <option value={i.toString()} key={i}>
            {s}
          </option>
        ))}
      </select>
    </Annotation>
  );
}

export function LabeledSelect<T>({
  label,
  ...props
}: SelectProps<T> & { label: string }) {
  return (
    <div className='flex flex-row'>
      <Select {...props} />
      <div className='opacity-50'> : {label} </div>
    </div>
  );
}

type SelectAutoProps<T> = {
  value: T;
  values: T[];
} & Pick<SelectProps<T>, 'className' | 'onChange' | 'autofocus'>;

/**
 * Special case of <Select> where you are setting a string and the display
 * is the same as the value. (or attempts to coerce the value into a string)
 */
export function SelectAuto<T>({
  className,
  value,
  values,
  onChange,
  autofocus = false,
}: SelectAutoProps<T>) {
  return (
    <Select
      className={className}
      value={value}
      values={values.map((s) => [s + '', s] as [string, T])}
      onChange={onChange}
      autofocus={autofocus}
    />
  );
}
