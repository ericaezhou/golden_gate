import { GapPriority, GapStatus } from '@/types/conversation';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'default' | 'critical' | 'high' | 'medium' | 'low' | 'success' | 'info';
  size?: 'sm' | 'md';
  className?: string;
}

export function Badge({
  children,
  variant = 'default',
  size = 'sm',
  className = '',
}: BadgeProps) {
  const variants = {
    default: 'bg-gray-100 text-gray-700',
    critical: 'bg-red-100 text-red-700',
    high: 'bg-orange-100 text-orange-700',
    medium: 'bg-yellow-100 text-yellow-700',
    low: 'bg-green-100 text-green-700',
    success: 'bg-green-100 text-green-700',
    info: 'bg-blue-100 text-blue-700',
  };

  const sizes = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
  };

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: GapPriority }) {
  const config: Record<GapPriority, { label: string; variant: BadgeProps['variant'] }> = {
    critical: { label: 'Critical', variant: 'critical' },
    high: { label: 'High', variant: 'high' },
    medium: { label: 'Medium', variant: 'medium' },
    low: { label: 'Low', variant: 'low' },
  };

  const { label, variant } = config[priority];
  return <Badge variant={variant}>{label}</Badge>;
}

export function StatusBadge({ status }: { status: GapStatus }) {
  const config: Record<GapStatus, { label: string; variant: BadgeProps['variant'] }> = {
    not_started: { label: 'Not Started', variant: 'default' },
    in_progress: { label: 'In Progress', variant: 'info' },
    captured: { label: 'Captured', variant: 'success' },
    verified: { label: 'Verified', variant: 'success' },
  };

  const { label, variant } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}
