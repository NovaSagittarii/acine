interface EditableTextProps {
  children: React.ReactNode | string;
  className?: string;
  onChange: (newText: string) => void; // called when text updated
}

function EditableText({
  children,
  className = '',
  onChange,
}: EditableTextProps) {
  return (
    <div
      className={
        'hover:bg-black/5 hover:cursor-text transition-colors ' + className
      }
      onClick={() => {
        const newText = prompt(
          `replace ${children} with? (leave empty to cancel)`,
        );
        if (newText) {
          onChange(newText);
        }
      }}
    >
      {children}
    </div>
  );
}

export default EditableText;
