interface CheckboxProps {
  value: boolean;
  className?: string;
  label?: React.ReactNode;
  onChange?: (newValue: boolean) => void;
}

export default function Checkbox({
  value,
  className = '',
  label = '',
  onChange = () => {},
}: CheckboxProps) {
  return (
    <div className={`flex gap-1 ${className}`}>
      <input
        type='checkbox'
        checked={value}
        onChange={() => onChange(!value)}
      />
      {label}
    </div>
  );
}
