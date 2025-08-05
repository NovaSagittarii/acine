interface ButtonProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void | Promise<void>;
}

function Button({ children, className = '', onClick = () => {} }: ButtonProps) {
  return (
    <div
      onClick={() => void onClick()}
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
