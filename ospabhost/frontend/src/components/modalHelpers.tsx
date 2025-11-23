// Утилиты для совместимости со старым кодом, использующим alert/confirm/prompt
// Этот файл позволяет заменить window.alert/confirm/prompt на наши компоненты

import { createRoot } from 'react-dom/client';
import { Modal, PromptModal } from './Modal';

// Улучшенный alert через toast (если доступен) или через модальное окно
export const showAlert = (message: string, type: 'success' | 'error' | 'info' | 'warning' = 'info'): Promise<void> => {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleClose = () => {
      root.unmount();
      document.body.removeChild(container);
      resolve();
    };

    const iconMap = {
      success: '✓',
      error: '×',
      info: 'i',
      warning: '!'
    };

    root.render(
      <Modal
        isOpen={true}
        onClose={handleClose}
        title={iconMap[type] + ' Уведомление'}
        type={type === 'success' ? 'info' : type === 'error' ? 'danger' : type}
        confirmText="OK"
      >
        <p>{message}</p>
      </Modal>
    );
  });
};

// Улучшенный confirm через модальное окно
export const showConfirm = (message: string, title: string = 'Подтвердите действие'): Promise<boolean> => {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleClose = (result: boolean) => {
      root.unmount();
      document.body.removeChild(container);
      resolve(result);
    };

    root.render(
      <Modal
        isOpen={true}
        onClose={() => handleClose(false)}
        title={title}
        type="warning"
        onConfirm={() => handleClose(true)}
        confirmText="Да"
        cancelText="Отмена"
      >
        <p>{message}</p>
      </Modal>
    );
  });
};

// Улучшенный prompt через модальное окно
export const showPrompt = (message: string, title: string = 'Введите значение', defaultValue: string = ''): Promise<string | null> => {
  return new Promise((resolve) => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const handleClose = (value: string | null) => {
      root.unmount();
      document.body.removeChild(container);
      resolve(value);
    };

    root.render(
      <PromptModal
        isOpen={true}
        onClose={() => handleClose(null)}
        title={title}
        message={message}
        onConfirm={(value) => handleClose(value)}
        defaultValue={defaultValue}
        placeholder="Введите значение..."
      />
    );
  });
};
