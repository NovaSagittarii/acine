interface CheckboxProps {
  value: boolean;
  onChange?: (newValue: boolean) => void;
}

export default function Checkbox({
  value,
  onChange = () => {},
}: CheckboxProps) {
  return (
    <input type='checkbox' checked={value} onChange={() => onChange(!value)} />
  );
}
