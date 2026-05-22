import { clsx } from 'clsx';

type PanelProps = {
  children: React.ReactNode;
  className?: string;
};

export function Panel({ children, className }: PanelProps) {
  return <section className={clsx('panel', className)}>{children}</section>;
}
