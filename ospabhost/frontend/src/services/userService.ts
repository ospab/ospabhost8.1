import apiClient from '../utils/apiClient';

const API_URL = '/api/user';
const SESSIONS_API = '/api/sessions'; // Отдельный эндпоинт для сессий

// Типы
export interface UserProfile {
  id: number;
  username: string;
  email: string;
  balance: number;
  createdAt: string;
  profile?: {
    avatarUrl?: string;
    phoneNumber?: string;
    timezone?: string;
    language?: string;
    profilePublic: boolean;
    showEmail: boolean;
    twoFactorEnabled: boolean;
  };
  notificationSettings?: NotificationSettings;
  _count?: {
    servers: number;
    tickets: number;
    sessions: number;
    sshKeys: number;
    apiKeys: number;
  };
}

export interface Session {
  id: number;
  token: string;
  ipAddress?: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  location?: string;
  lastActivity: string;
  createdAt: string;
  expiresAt: string;
  isCurrent?: boolean;
}

export interface LoginHistoryEntry {
  id: number;
  ipAddress: string;
  userAgent?: string;
  device?: string;
  browser?: string;
  location?: string;
  success: boolean;
  createdAt: string;
}

export interface SSHKey {
  id: number;
  name: string;
  publicKey: string;
  fingerprint: string;
  createdAt: string;
  lastUsed?: string;
}

export interface APIKey {
  id: number;
  name: string;
  prefix: string;
  permissions?: string;
  lastUsed?: string;
  createdAt: string;
  expiresAt?: string;
}

export interface NotificationSettings {
  id: number;
  userId: number;
  emailServerCreated: boolean;
  emailServerStopped: boolean;
  emailBalanceLow: boolean;
  emailPaymentCharged: boolean;
  emailTicketReply: boolean;
  emailNewsletter: boolean;
  pushServerCreated: boolean;
  pushServerStopped: boolean;
  pushBalanceLow: boolean;
  pushPaymentCharged: boolean;
  pushTicketReply: boolean;
  updatedAt: string;
}

// Получить токен из localStorage
const getAuthHeader = () => {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ============ ПРОФИЛЬ ============

export const getProfile = async (): Promise<UserProfile> => {
  const response = await apiClient.get(`${API_URL}/profile`, {
    headers: getAuthHeader()
  });
  return response.data.data;
};

export const updateProfile = async (data: {
  username?: string;
  email?: string;
  phoneNumber?: string;
  timezone?: string;
  language?: string;
}): Promise<void> => {
  await apiClient.put(`${API_URL}/profile`, data, {
    headers: getAuthHeader()
  });
};

// ============ БЕЗОПАСНОСТЬ ============

export const changePassword = async (data: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> => {
  await apiClient.post(`${API_URL}/change-password`, data, {
    headers: getAuthHeader()
  });
};

export const getSessions = async (): Promise<Session[]> => {
  const response = await apiClient.get(`${SESSIONS_API}`, {
    headers: getAuthHeader()
  });
  return response.data; // Backend возвращает массив напрямую
};

export const terminateSession = async (sessionId: number): Promise<void> => {
  await apiClient.delete(`${SESSIONS_API}/${sessionId}`, {
    headers: getAuthHeader()
  });
};

export const getLoginHistory = async (limit = 20): Promise<LoginHistoryEntry[]> => {
  const response = await apiClient.get(`${SESSIONS_API}/history`, {
    headers: getAuthHeader(),
    params: { limit }
  });
  return response.data; // Backend возвращает массив напрямую
};

// ============ АВАТАР ============

export const uploadAvatar = async (file: File): Promise<{ avatarUrl: string }> => {
  const formData = new FormData();
  formData.append('avatar', file);

  const response = await apiClient.post(`${API_URL}/avatar`, formData, {
    headers: {
      ...getAuthHeader(),
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data.data;
};

export const deleteAvatar = async (): Promise<void> => {
  await apiClient.delete(`${API_URL}/avatar`, {
    headers: getAuthHeader()
  });
};

// ============ SSH КЛЮЧИ ============

export const getSSHKeys = async (): Promise<SSHKey[]> => {
  const response = await apiClient.get(`${API_URL}/ssh-keys`, {
    headers: getAuthHeader()
  });
  return response.data.data;
};

export const addSSHKey = async (data: {
  name: string;
  publicKey: string;
}): Promise<SSHKey> => {
  const response = await apiClient.post(`${API_URL}/ssh-keys`, data, {
    headers: getAuthHeader()
  });
  return response.data.data;
};

export const deleteSSHKey = async (keyId: number): Promise<void> => {
  await apiClient.delete(`${API_URL}/ssh-keys/${keyId}`, {
    headers: getAuthHeader()
  });
};

// ============ API КЛЮЧИ ============

export const getAPIKeys = async (): Promise<APIKey[]> => {
  const response = await apiClient.get(`${API_URL}/api-keys`, {
    headers: getAuthHeader()
  });
  return response.data.data;
};

export const createAPIKey = async (data: {
  name: string;
  permissions?: string[];
  expiresAt?: string;
}): Promise<APIKey & { fullKey: string }> => {
  const response = await apiClient.post(`${API_URL}/api-keys`, data, {
    headers: getAuthHeader()
  });
  return response.data.data;
};

export const deleteAPIKey = async (keyId: number): Promise<void> => {
  await apiClient.delete(`${API_URL}/api-keys/${keyId}`, {
    headers: getAuthHeader()
  });
};

// ============ НАСТРОЙКИ УВЕДОМЛЕНИЙ ============

export const getNotificationSettings = async (): Promise<NotificationSettings> => {
  const response = await apiClient.get(`${API_URL}/notification-settings`, {
    headers: getAuthHeader()
  });
  return response.data.data;
};

export const updateNotificationSettings = async (
  settings: Partial<NotificationSettings>
): Promise<void> => {
  await apiClient.put(`${API_URL}/notification-settings`, settings, {
    headers: getAuthHeader()
  });
};

// ============ ЭКСПОРТ ДАННЫХ ============

export const exportUserData = async (): Promise<Record<string, unknown>> => {
  const response = await apiClient.get(`${API_URL}/export`, {
    headers: getAuthHeader()
  });
  return response.data;
};
