import { useState } from 'react';

interface SelectProps<T> {
  className?: string;
  /** current displayed index (this is a controlled element) */
  value: number;

  /** list of options; an option consists of [display, value] */
  values: [string, T][];

  /** calls onChange with the [value] of the selected item  */
  onChange: (newValue: T) => void;
}

/**
 * Dropdown select UI element.
 *
 * `values` prop is in the form [displayString, actualValue]
 */
export default function Select<T>({
  value,
  values,
  onChange,
  className = '',
}: SelectProps<T>) {
  // const [selectedIndex, setSelectedIndex] = useState(value);
  return (
    <select
      className={'hover:bg-black/5 hover:cursor-text ' + className}
      onChange={(ev) => {
        const index = +ev.target.value;
        // setSelectedIndex(index);
        onChange(values[index][1]);
      }}
      value={value}
    >
      {values.map(([s, _v], i) => (
        <option value={i.toString()} key={i}>
          {s}
        </option>
      ))}
    </select>
  );
}

type SelectAutoProps<T> = {
  values: T[];
} & Pick<SelectProps<T>, 'className' | 'value' | 'onChange'>;

/**
 * Special case of <Select> where you are setting a string and the display
 * is the same as the value. (or attempts to coerce the value into a string)
 */
export function SelectAuto<T>({
  className,
  value = 0,
  values,
  onChange,
}: SelectAutoProps<T>) {
  return (
    <Select
      className={className}
      value={value}
      values={values.map((s) => [s + '', s] as [string, T])}
      onChange={onChange}
    />
  );
}
