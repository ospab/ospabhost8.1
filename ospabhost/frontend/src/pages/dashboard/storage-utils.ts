import type { StorageBucket } from './types';

export interface StatusBadge {
  label: string;
  className: string;
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return '0 B';
  }
  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  const digits = value >= 10 || index === 0 ? 0 : 2;
  return `${value.toFixed(digits)} ${units[index]}`;
}

export function formatDate(value?: string | null, withTime = false): string {
  if (!value) {
    return '—';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }
  const options: Intl.DateTimeFormatOptions = withTime
    ? { dateStyle: 'short', timeStyle: 'short' }
    : { dateStyle: 'short' };
  return date.toLocaleString('ru-RU', options);
}

export function getUsagePercent(usedBytes: number, quotaGb: number): number {
  if (!Number.isFinite(quotaGb) || quotaGb <= 0) {
    return 0;
  }
  const quotaBytes = quotaGb * 1024 * 1024 * 1024;
  if (quotaBytes <= 0) {
    return 0;
  }
  return Math.min((usedBytes / quotaBytes) * 100, 100);
}

export function getPlanTone(plan: string): string {
  if (!plan) {
    return 'bg-gray-100 text-gray-700';
  }
  const normalized = plan.toLowerCase();
  const variants: Record<string, string> = {
    basic: 'bg-blue-100 text-blue-700',
    standard: 'bg-green-100 text-green-700',
    plus: 'bg-purple-100 text-purple-700',
    pro: 'bg-orange-100 text-orange-700',
    enterprise: 'bg-red-100 text-red-700',
  };
  return variants[normalized] ?? 'bg-gray-100 text-gray-700';
}

export function getStatusBadge(status: StorageBucket['status']): StatusBadge {
  const normalized = (status ?? '').toLowerCase();
  switch (normalized) {
    case 'active':
      return { label: 'Активен', className: 'bg-green-100 text-green-700' };
    case 'creating':
      return { label: 'Создаётся', className: 'bg-blue-100 text-blue-700' };
    case 'suspended':
      return { label: 'Приостановлен', className: 'bg-yellow-100 text-yellow-700' };
    case 'error':
    case 'failed':
      return { label: 'Ошибка', className: 'bg-red-100 text-red-700' };
    default:
      return { label: status ?? 'Неизвестно', className: 'bg-gray-100 text-gray-600' };
  }
}

export function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
}
