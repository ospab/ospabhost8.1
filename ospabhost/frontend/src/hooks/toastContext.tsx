import { createContext } from 'react';
import type { ToastType } from '../components/Toast';

export interface ToastContextType {
  toasts: Array<{ id: string; message: string; type: ToastType }>;
  addToast: (message: string, type?: ToastType) => void;
  removeToast: (id: string) => void;
}

export const ToastContext = createContext<ToastContextType | undefined>(undefined);
