// Общие типы для обработки ошибок

export interface ProxmoxError extends Error {
  response?: {
    status?: number;
    statusText?: string;
    data?: {
      errors?: string;
      message?: string;
      data?: null;
    };
  };
  code?: string;
}

export interface AxiosError extends Error {
  response?: {
    status?: number;
    statusText?: string;
    data?: unknown;
  };
  code?: string;
  isAxiosError?: boolean;
}

export function isAxiosError(error: unknown): error is AxiosError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'isAxiosError' in error &&
    (error as AxiosError).isAxiosError === true
  );
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Неизвестная ошибка';
}

export function getProxmoxErrorMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const err = error as ProxmoxError;
    if (err.response?.data?.errors) {
      return err.response.data.errors;
    }
    if (err.message) {
      return err.message;
    }
  }
  return getErrorMessage(error);
}
