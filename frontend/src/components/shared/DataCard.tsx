import type { ReactNode } from 'react';

interface DataCardProps {
  children: ReactNode;
  className?: string;
  padding?: boolean;
}

export default function DataCard({
  children,
  className = '',
  padding = true,
}: DataCardProps) {
  return (
    <section
      className={[
        'w-full',
        'rounded-xl',
        'border border-outline-variant/70',
        'bg-surface-container-lowest',
        'shadow-[0_1px_3px_rgba(15,23,42,0.05)]',
        'transition-shadow duration-200',
        'hover:shadow-[0_4px_14px_rgba(15,23,42,0.07)]',
        padding ? 'p-5 sm:p-6' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </section>
  );
}