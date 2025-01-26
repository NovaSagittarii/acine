interface ButtonProps {
  children: React.ReactNode;
  className?: string;
}

function Button({ children, className = '' }: ButtonProps) {
  return (
    <div
      className={
        'p-4 rounded-lg text-center hover:scale-105 active:scale-95 transition-transform select-none ' +
        className
      }
    >
      {children}
    </div>
  );
}

export default Button;
