import axios, { AxiosError } from 'axios';
import type { InternalAxiosRequestConfig } from 'axios';
import { API_URL } from '../config/api';

// Создаём экземпляр axios с базовым URL
export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 120000, // 120 seconds timeout
});

// Добавляем токен к каждому запросу
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('access_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Обработка ответов и ошибок
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError) => {
    if (error.response) {
      const status = error.response.status;
      
      // Обрабатываем ошибки без автоматического перенаправления
      // Компоненты сами решают, как обрабатывать ошибки
      switch (status) {
        case 401:
          // Unauthorized - очищаем токен
          localStorage.removeItem('access_token');
          sessionStorage.clear();
          // Вызываем событие для реакции на изменение авторизации
          window.dispatchEvent(new Event('unauthorized'));
          break;
        case 403:
          // Forbidden - нет прав доступа
          console.warn('Access denied (403)');
          break;
        case 404:
          // Not Found - ресурс не найден
          console.warn('Resource not found (404)');
          break;
        case 500:
        case 502:
        case 503:
        case 504:
          // Server errors
          console.error(`Server error (${status})`);
          break;
      }
    } else if (error.request) {
      // Ошибка сети - сервер недоступен
      console.error('Network error:', error.message);
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
