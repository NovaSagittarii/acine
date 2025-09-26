interface SectionProps {
  children: React.ReactNode;
  className?: string;
  hoverClassName?: string;
}

/**
 * ui section, draws a border on hover to get user focus
 */
export function Section({
  children,
  className = '',
  hoverClassName = 'border-black/10 hover:border-black/50',
}: SectionProps) {
  return (
    <div
      className={`flex p-1 border rounded-sm ${hoverClassName} ${className}`}
    >
      {children}
    </div>
  );
}

export default {
  h1: (x: SectionProps) =>
    Section({ ...x, hoverClassName: 'border-black/5 hover:border-black/60' }),
  h2: (x: SectionProps) =>
    Section({ ...x, hoverClassName: 'border-black/5 hover:border-black/30' }),
  h3: (x: SectionProps) =>
    Section({ ...x, hoverClassName: 'border-black/5 hover:border-black/15' }),
};
