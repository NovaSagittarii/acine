import { useState } from 'react';

interface SelectProps<T> {
  className?: string;
  defaultIndex?: number;
  values: [string, T][];
  onChange: (newValue: T) => void;
}

/**
 * Dropdown select UI element.
 *
 * `values` prop is in the form [displayString, actualValue]
 */
export default function Select<T>({
  defaultIndex = 0,
  values,
  onChange,
  className = '',
}: SelectProps<T>) {
  const [selectedIndex, setSelectedIndex] = useState(defaultIndex);
  return (
    <select
      className={'hover:bg-black/5 hover:cursor-text ' + className}
      onChange={(ev) => {
        const index = +ev.target.value;
        setSelectedIndex(index);
        onChange(values[index][1]);
      }}
      defaultValue={selectedIndex} // this seems to be broken
    >
      {values.map(([s, _v], i) => (
        <option value={i} key={i}>
          {s}
        </option>
      ))}
    </select>
  );
}

type SelectAutoProps<T> = {
  values: T[];
} & Pick<SelectProps<T>, 'className' | 'defaultIndex' | 'onChange'>;

/**
 * Special case of <Select> where you are setting a string and the display
 * is the same as the value. (or attempts to coerce the value into a string)
 */
export function SelectAuto<T>({
  className,
  defaultIndex = 0,
  values,
  onChange,
}: SelectAutoProps<T>) {
  return (
    <Select
      className={className}
      defaultIndex={defaultIndex}
      values={values.map((s) => [s + '', s] as [string, T])}
      onChange={onChange}
    />
  );
}
