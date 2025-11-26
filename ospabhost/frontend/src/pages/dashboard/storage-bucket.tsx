import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { isAxiosError } from 'axios';
import {
  FiArrowLeft,
  FiRefreshCw,
  FiDatabase,
  FiUpload,
  FiTrash2,
  FiDownload,
  FiKey,
  FiCopy,
  FiInfo,
  FiHelpCircle,
  FiSettings,
  FiFolder,
  FiBarChart2,
} from 'react-icons/fi';
import apiClient from '../../utils/apiClient';
import { useToast } from '../../hooks/useToast';
import { getFiles, deleteFilesByBucket } from '../../utils/uploadDB';
import type { StorageAccessKey, StorageBucket, StorageObject } from './types';
import { formatBytes, formatCurrency, formatDate, getPlanTone, getStatusBadge, getUsagePercent } from './storage-utils';

interface ObjectsResponse {
  objects: StorageObject[];
  nextCursor?: string | null;
}

interface PresignResponse {
  url: string;
  method: 'GET' | 'PUT';
}

interface CreatedKey {
  accessKey: string;
  secretKey: string;
  label?: string | null;
}

interface UploadProgress {
  loaded: number;
  total: number;
  speed: number;
  percentage: number;
}

const TEN_GIB = 10 * 1024 * 1024 * 1024;

const TAB_ITEMS = [
  {
    key: 'summary',
    label: 'Сводка',
    icon: FiBarChart2,
    description: 'Статистика, квоты и текущее состояние бакета.',
  },
  {
    key: 'files',
    label: 'Файлы',
    icon: FiFolder,
    description: 'Загрузка, скачивание и управление объектами.',
  },
  {
    key: 'settings',
    label: 'Настройки',
    icon: FiSettings,
    description: 'Права доступа, версионирование и ключи API.',
  },
] as const;

type TabKey = (typeof TAB_ITEMS)[number]['key'];

type LoadObjectsOptions = {
  reset?: boolean;
  cursor?: string | null;
  prefix?: string;
};

type ConsoleCredentials = {
  login: string;
  password: string;
  url?: string | null;
};

type BucketLocationState = {
  consoleCredentials?: ConsoleCredentials;
  bucketName?: string;
};

const StorageBucketPage: React.FC = () => {
  const { bucketId: bucketIdParam } = useParams<{ bucketId: string }>();
  const bucketNumber = bucketIdParam ? Number(bucketIdParam) : NaN;
  const bucketIdValid = Number.isInteger(bucketNumber) && bucketNumber > 0;

  const location = useLocation();
  const navigate = useNavigate();
  const { addToast } = useToast();

  const objectPrefixRef = useRef('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const directoryInputRef = useRef<HTMLInputElement | null>(null);
  const fileDialogOpenRef = useRef(false);

  const [activeTab, setActiveTab] = useState<TabKey>('summary');

  const [bucket, setBucket] = useState<StorageBucket | null>(null);
  const [bucketLoading, setBucketLoading] = useState(true);
  const [bucketRefreshing, setBucketRefreshing] = useState(false);
  const [bucketActionPending, setBucketActionPending] = useState(false);
  const [bucketError, setBucketError] = useState<string | null>(null);

  const [objects, setObjects] = useState<StorageObject[]>([]);
  const [objectsLoading, setObjectsLoading] = useState(true);
  const [objectsLoadingMore, setObjectsLoadingMore] = useState(false);
  const [objectsCursor, setObjectsCursor] = useState<string | null>(null);
  const [objectPrefix, setObjectPrefix] = useState('');
  const [objectSearch, setObjectSearch] = useState('');
  const [selectedKeys, setSelectedKeys] = useState<Record<string, boolean>>({});

  const [uploadPath, setUploadPath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<Record<string, UploadProgress>>({});
  const [uploadStats, setUploadStats] = useState<{ currentFile: string; completedFiles: number; totalFiles: number }>({ currentFile: '', completedFiles: 0, totalFiles: 0 });
  const [uriUploadUrl, setUriUploadUrl] = useState('');
  const [uriUploadLoading, setUriUploadLoading] = useState(false);
  const [resumedFiles, setResumedFiles] = useState<File[]>([]);
  const uploadAbortControllerRef = useRef<AbortController | null>(null);

  const [accessKeys, setAccessKeys] = useState<StorageAccessKey[]>([]);
  const [accessKeysLoading, setAccessKeysLoading] = useState(false);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [creatingKey, setCreatingKey] = useState(false);
  const [deletingKeys, setDeletingKeys] = useState<Record<number, boolean>>({});
  const [lastCreatedKey, setLastCreatedKey] = useState<CreatedKey | null>(null);

  const selectedList = useMemo(
    () => Object.entries(selectedKeys).filter(([, value]) => value).map(([key]) => key),
    [selectedKeys],
  );
  const selectedCount = selectedList.length;
  const allSelected = objects.length > 0 && objects.every((object) => selectedKeys[object.key]);

  const [consoleCredentials, setConsoleCredentials] = useState<ConsoleCredentials | null>(() => {
    const state = location.state as BucketLocationState | undefined;
    return state?.consoleCredentials ?? null;
  });
  const [consoleCredentialsLoading, setConsoleCredentialsLoading] = useState(false);
  const [consoleCredentialsError, setConsoleCredentialsError] = useState<string | null>(null);

  const dispatchBucketsRefresh = useCallback(() => {
    window.dispatchEvent(new Event('storageBucketsRefresh'));
  }, []);

  const fetchBucket = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!bucketIdValid) {
      setBucket(null);
      setBucketError('Некорректный идентификатор бакета');
      setBucketLoading(false);
      return;
    }

    if (options.silent) {
      setBucketRefreshing(true);
    } else {
      setBucketLoading(true);
    }

    try {
      const { data } = await apiClient.get<{ bucket: StorageBucket }>(`/api/storage/buckets/${bucketNumber}`);
      setBucket(data.bucket);
      setBucketError(null);
    } catch (error) {
      let message = 'Не удалось загрузить бакет';
      if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
        message = error.response.data.error;
      }
      setBucket(null);
      setBucketError(message);
      addToast(message, 'error');
    } finally {
      if (options.silent) {
        setBucketRefreshing(false);
      } else {
        setBucketLoading(false);
      }
    }
  }, [addToast, bucketIdValid, bucketNumber]);

  const loadObjects = useCallback(async ({ reset = false, cursor = null, prefix }: LoadObjectsOptions = {}) => {
    if (!bucketIdValid) {
      setObjectsLoading(false);
      setObjectsLoadingMore(false);
      return;
    }

    if (reset) {
      setObjectsLoading(true);
      setSelectedKeys({});
    } else if (cursor) {
      setObjectsLoadingMore(true);
    } else {
      setObjectsLoading(true);
    }

    try {
      const params: Record<string, string> = {};
      if (typeof prefix === 'string') {
        objectPrefixRef.current = prefix.trim();
      }
      const effectivePrefix = objectPrefixRef.current.trim();
      if (effectivePrefix) {
        params.prefix = effectivePrefix;
      }
      if (cursor) {
        params.cursor = cursor;
      }

      const { data } = await apiClient.get<ObjectsResponse>(`/api/storage/buckets/${bucketNumber}/objects`, { params });
      setObjects((prev) => (reset ? data.objects : [...prev, ...data.objects]));
      setObjectsCursor(data.nextCursor ?? null);
    } catch (error) {
      console.error('[StorageBucket] Не удалось получить список объектов', error);
      addToast('Не удалось загрузить список объектов', 'error');
    } finally {
      setObjectsLoading(false);
      setObjectsLoadingMore(false);
    }
  }, [addToast, bucketIdValid, bucketNumber]);

  const fetchAccessKeys = useCallback(async () => {
    if (!bucketIdValid) {
      setAccessKeys([]);
      return;
    }
    setAccessKeysLoading(true);
    try {
      const { data } = await apiClient.get<{ keys: StorageAccessKey[] }>(`/api/storage/buckets/${bucketNumber}/access-keys`);
      setAccessKeys(data.keys);
    } catch (error) {
      console.error('[StorageBucket] Не удалось получить ключи доступа', error);
      addToast('Не удалось загрузить ключи доступа', 'error');
    } finally {
      setAccessKeysLoading(false);
    }
  }, [addToast, bucketIdValid, bucketNumber]);

  const updateBucketSettings = useCallback(async (payload: Record<string, unknown>, successMessage?: string) => {
    if (!bucketIdValid) {
      return;
    }
    setBucketActionPending(true);
    try {
      const { data } = await apiClient.patch<{ bucket: StorageBucket }>(`/api/storage/buckets/${bucketNumber}`, payload);
      setBucket(data.bucket);
      if (successMessage) {
        addToast(successMessage, 'success');
      }
      dispatchBucketsRefresh();
    } catch (error) {
      let message = 'Не удалось обновить настройки бакета';
      if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
        message = error.response.data.error;
      }
      addToast(message, 'error');
    } finally {
      setBucketActionPending(false);
    }
  }, [addToast, bucketIdValid, bucketNumber, dispatchBucketsRefresh]);

  const togglePublic = useCallback(() => {
    if (!bucket) {
      return;
    }
    const next = !bucket.public;
    updateBucketSettings({ public: next }, next ? 'Публичный доступ включён' : 'Публичный доступ отключён');
  }, [bucket, updateBucketSettings]);

  const toggleVersioning = useCallback(() => {
    if (!bucket) {
      return;
    }
    const next = !bucket.versioning;
    updateBucketSettings({ versioning: next }, next ? 'Версионирование включено' : 'Версионирование отключено');
  }, [bucket, updateBucketSettings]);

  const toggleAutoRenew = useCallback(() => {
    if (!bucket) {
      return;
    }
    const next = !bucket.autoRenew;
    updateBucketSettings({ autoRenew: next }, next ? 'Автопродление включено' : 'Автопродление отключено');
  }, [bucket, updateBucketSettings]);

  const handleRefreshBucket = useCallback(() => {
    fetchBucket({ silent: true });
    loadObjects({ reset: true });
    fetchAccessKeys();
  }, [fetchAccessKeys, fetchBucket, loadObjects]);

  const handleApplyFilter = useCallback((event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = objectSearch.trim();
    setObjectPrefix(trimmed);
    loadObjects({ reset: true, prefix: trimmed });
  }, [loadObjects, objectSearch]);

  const handleResetFilter = useCallback(() => {
    setObjectSearch('');
    setObjectPrefix('');
    loadObjects({ reset: true, prefix: '' });
  }, [loadObjects]);

  const handleGenerateConsoleCredentials = useCallback(async () => {
    if (!bucketIdValid) {
      return;
    }

    try {
      setConsoleCredentialsLoading(true);
      setConsoleCredentialsError(null);
      setConsoleCredentials(null);
      const { data } = await apiClient.post<{ credentials?: ConsoleCredentials }>(
        `/api/storage/buckets/${bucketNumber}/console-credentials`
      );

      const credentials = data?.credentials;
      if (!credentials) {
        throw new Error('Сервер не вернул данные входа');
      }

      setConsoleCredentials(credentials);
      addToast('Создан новый пароль для MinIO Console', 'success');
      await fetchBucket({ silent: true });
    } catch (error) {
      let message = 'Не удалось сгенерировать данные входа';
      if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
        message = error.response.data.error;
      } else if (error instanceof Error) {
        message = error.message;
      }
      setConsoleCredentialsError(message);
      addToast(message, 'error');
    } finally {
      setConsoleCredentialsLoading(false);
    }
  }, [addToast, bucketIdValid, bucketNumber, fetchBucket]);

  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      setSelectedKeys({});
    } else {
      const nextSelection: Record<string, boolean> = {};
      objects.forEach((object) => {
        nextSelection[object.key] = true;
      });
      setSelectedKeys(nextSelection);
    }
  }, [allSelected, objects]);

  const handleToggleSelection = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = { ...prev };
      if (next[key]) {
        delete next[key];
      } else {
        next[key] = true;
      }
      return next;
    });
  }, []);

  const handleClearSelection = useCallback(() => {
    setSelectedKeys({});
  }, []);

  const handleDownloadObject = useCallback(async (object: StorageObject) => {
    if (object.size >= TEN_GIB) {
      const confirmed = window.confirm('Файл весит больше 10 ГБ. Скачивание может занять продолжительное время. Продолжить?');
      if (!confirmed) {
        return;
      }
    }

    try {
      const { data } = await apiClient.post<PresignResponse>(`/api/storage/buckets/${bucketNumber}/objects/presign`, {
        key: object.key,
        method: 'GET',
        download: true,
        downloadFileName: object.key.split('/').pop() ?? object.key,
      });

      const link = document.createElement('a');
      link.href = data.url;
      link.rel = 'noopener';
      link.download = object.key.split('/').pop() ?? object.key;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (error) {
      let message = 'Не удалось скачать объект';
      if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
        message = error.response.data.error;
      }
      addToast(message, 'error');
    }
  }, [addToast, bucketNumber]);

  const handleDeleteObjects = useCallback(async () => {
    if (selectedList.length === 0) {
      return;
    }
    const confirmed = window.confirm(`Удалить ${selectedList.length} объект(ов)? Действие нельзя отменить.`);
    if (!confirmed) {
      return;
    }

    try {
      await apiClient.delete(`/api/storage/buckets/${bucketNumber}/objects`, {
        data: { keys: selectedList },
      });
      addToast(`Удалено объектов: ${selectedList.length}`, 'success');
      setSelectedKeys({});
      loadObjects({ reset: true });
      fetchBucket({ silent: true });
      dispatchBucketsRefresh();
    } catch (error) {
      let message = 'Не удалось удалить объекты';
      if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
        message = error.response.data.error;
      }
      addToast(message, 'error');
    }
  }, [addToast, bucketNumber, dispatchBucketsRefresh, fetchBucket, loadObjects, selectedList]);

  const performUpload = useCallback(async (files: File[]) => {
    if (files.length === 0 || uploading) {
      return;
    }

    const abortController = new AbortController();
    uploadAbortControllerRef.current = abortController;
    setUploading(true);
    setUploadStats({ currentFile: '', completedFiles: 0, totalFiles: files.length });
    const progressMap: Record<string, UploadProgress> = {};

    try {
      // Сохраняем файлы в IndexedDB перед загрузкой
      const { saveFile } = await import('../../utils/uploadDB');
      for (const file of files) {
        const arrayBuffer = await file.arrayBuffer();
        await saveFile({
          id: `${bucketNumber}_${Date.now()}_${file.name}`,
          bucketId: bucketNumber,
          name: file.name,
          size: file.size,
          type: file.type,
          data: arrayBuffer,
          uploadPath: uploadPath.trim(),
          timestamp: Date.now(),
        });
      }

      const normalizedPrefix = uploadPath.trim().replace(/\\/g, '/').replace(/^\/+/u, '').replace(/\/+$/u, '');
      
      for (let i = 0; i < files.length; i++) {
        // Проверяем отмену
        if (abortController.signal.aborted) {
          throw new Error('Загрузка отменена');
        }

        const file = files[i];
        setUploadStats({ currentFile: file.name, completedFiles: i, totalFiles: files.length });
        
        progressMap[file.name] = { loaded: 0, total: file.size, speed: 0, percentage: 0 };

        const key = normalizedPrefix ? `${normalizedPrefix}/${file.name}` : file.name;
        const { data } = await apiClient.post<PresignResponse>(`/api/storage/buckets/${bucketNumber}/objects/presign`, {
          key,
          method: 'PUT',
          contentType: file.type || undefined,
        });

        const startTime = Date.now();
        const xhr = new XMLHttpRequest();

        // Track upload progress
        xhr.upload.addEventListener('progress', (event) => {
          if (event.lengthComputable) {
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = elapsed > 0 ? event.loaded / elapsed : 0;
            const percentage = Math.round((event.loaded / event.total) * 100);

            progressMap[file.name] = {
              loaded: event.loaded,
              total: event.total,
              speed,
              percentage,
            };
            setUploadProgress({ ...progressMap });
          }
        });

        await new Promise<void>((resolve, reject) => {
          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              progressMap[file.name].percentage = 100;
              setUploadProgress({ ...progressMap });
              resolve();
            } else {
              reject(new Error(`Загрузка файла «${file.name}» завершилась с ошибкой (${xhr.status})`));
            }
          });

          xhr.addEventListener('error', () => {
            reject(new Error(`Ошибка при загрузке файла «${file.name}»`));
          });

          xhr.open('PUT', data.url);
          if (file.type) {
            xhr.setRequestHeader('Content-Type', file.type);
          }
          xhr.send(file);
        });
      }

      // Успешная загрузка - удаляем файлы из IndexedDB
      const { deleteFilesByBucket } = await import('../../utils/uploadDB');
      await deleteFilesByBucket(bucketNumber);
      localStorage.removeItem(`uploadState_bucket_${bucketNumber}`);

      addToast(`Загружено файлов: ${files.length}`, 'success');
      setUploadProgress({});
      loadObjects({ reset: true });
      fetchBucket({ silent: true });
      dispatchBucketsRefresh();
    } catch (error) {
      let message = 'Не удалось загрузить файлы';
      if (error instanceof Error && error.message) {
        message = error.message;
      }
      if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
        message = error.response.data.error;
      }
      addToast(message, 'error');
      // Файлы остаются в IndexedDB для возможности повторной загрузки
    } finally {
      setUploading(false);
      setIsDragActive(false);
      setUploadStats({ currentFile: '', completedFiles: 0, totalFiles: 0 });
      uploadAbortControllerRef.current = null;
    }
  }, [addToast, bucketNumber, dispatchBucketsRefresh, fetchBucket, loadObjects, uploadPath, uploading, setUploadProgress, setUploadStats]);

  const handleCancelUpload = useCallback(() => {
    if (uploadAbortControllerRef.current) {
      uploadAbortControllerRef.current.abort();
      uploadAbortControllerRef.current = null;
    }
    setUploading(false);
    setUploadProgress({});
    setUploadStats({ currentFile: '', completedFiles: 0, totalFiles: 0 });
    addToast('Загрузка отменена', 'info');
  }, [addToast]);

  const handleClickSelectFiles = useCallback(() => {
    if (fileDialogOpenRef.current || uploading) {
      return;
    }
    fileDialogOpenRef.current = true;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
    setTimeout(() => {
      fileDialogOpenRef.current = false;
    }, 500);
  }, [uploading]);

  const handleClickSelectDirectory = useCallback(() => {
    if (fileDialogOpenRef.current || uploading) {
      return;
    }
    fileDialogOpenRef.current = true;
    if (directoryInputRef.current) {
      directoryInputRef.current.value = '';
      directoryInputRef.current.click();
    }
    setTimeout(() => {
      fileDialogOpenRef.current = false;
    }, 500);
  }, [uploading]);

  const uriUploadAbortControllerRef = useRef<AbortController | null>(null);

  const handleUriUpload = useCallback(async () => {
    if (!uriUploadUrl.trim()) {
      addToast('Введите URL', 'error');
      return;
    }

    setUriUploadLoading(true);
    const abortController = new AbortController();
    uriUploadAbortControllerRef.current = abortController;
    
    try {
      // Используем бэкенд proxy для обхода CORS с увеличенным timeout
      const response = await apiClient.post(
        `/api/storage/buckets/${bucketNumber}/objects/download-from-uri`,
        { url: uriUploadUrl },
        { timeout: 120000 } // 120 seconds timeout
      );

      if (response.data?.blob) {
        const blob = new Blob([response.data.blob], { type: response.data.mimeType || 'application/octet-stream' });
        const fileName = uriUploadUrl.split('/').pop() || 'file';
        const file = new File([blob], fileName, { type: blob.type });
        await performUpload([file]);
        setUriUploadUrl('');
      }
    } catch (error) {
      let message = 'Не удалось загрузить по URI';
      if (error instanceof Error && error.message === 'canceled') {
        message = 'Загрузка отменена';
      } else if (isAxiosError(error) && error.response?.data?.error) {
        message = error.response.data.error;
      } else if (error instanceof Error) {
        message = error.message;
      }
      addToast(message, 'error');
    } finally {
      setUriUploadLoading(false);
      uriUploadAbortControllerRef.current = null;
    }
  }, [uriUploadUrl, performUpload, addToast, bucketNumber]);

  const handleCancelUriUpload = useCallback(() => {
    if (uriUploadAbortControllerRef.current) {
      uriUploadAbortControllerRef.current.abort();
      uriUploadAbortControllerRef.current = null;
    }
    setUriUploadLoading(false);
    addToast('Загрузка отменена', 'info');
  }, [addToast]);

  const handleUploadInput = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (!files || files.length === 0) {
      return;
    }
    performUpload(Array.from(files));
    event.target.value = '';
  }, [performUpload]);

  const handleUploadDirectory = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { files } = event.target;
    if (!files || files.length === 0) {
      return;
    }
    // Фильтруем только файлы, пропускаем директории (у которых size === 0 и не webkitRelativePath)
    const fileArray = Array.from(files).filter(file => {
      // Skip empty folder entries
      return file.size > 0 || file.type !== '';
    });
    if (fileArray.length === 0) {
      addToast('Папка пуста или не содержит файлов', 'warning');
      event.target.value = '';
      return;
    }
    performUpload(fileArray);
    event.target.value = '';
  }, [performUpload, addToast]);

  const handleDropUpload = useCallback(async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(false);
    const { files } = event.dataTransfer;
    if (!files || files.length === 0) {
      return;
    }
    await performUpload(Array.from(files));
  }, [performUpload]);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragActive(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setIsDragActive(false);
    }
  }, []);

  const handleCopy = useCallback(async (value: string, label: string) => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      addToast(`${label} скопирован`, 'success');
    } catch {
      addToast('Не удалось скопировать в буфер обмена', 'error');
    }
  }, [addToast]);

  const handleCreateAccessKey = useCallback(async () => {
    if (!bucketIdValid || creatingKey) {
      return;
    }
    setCreatingKey(true);
    try {
      const { data } = await apiClient.post<{ key: CreatedKey }>(`/api/storage/buckets/${bucketNumber}/access-keys`, {
        label: newKeyLabel.trim() || undefined,
      });
      setNewKeyLabel('');
      setLastCreatedKey(data.key);
      addToast('Создан новый ключ доступа', 'success');
      fetchAccessKeys();
    } catch (error) {
      let message = 'Не удалось создать ключ';
      if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
        message = error.response.data.error;
      }
      addToast(message, 'error');
    } finally {
      setCreatingKey(false);
    }
  }, [addToast, bucketIdValid, bucketNumber, creatingKey, fetchAccessKeys, newKeyLabel]);

  const handleRevokeAccessKey = useCallback(async (keyId: number) => {
    const confirmed = window.confirm('Удалить ключ доступа? После удаления восстановить его будет невозможно.');
    if (!confirmed) {
      return;
    }
    setDeletingKeys((prev) => ({ ...prev, [keyId]: true }));
    try {
      await apiClient.delete(`/api/storage/buckets/${bucketNumber}/access-keys/${keyId}`);
      setAccessKeys((prev) => prev.filter((key) => key.id !== keyId));
      addToast('Ключ удалён', 'success');
    } catch (error) {
      let message = 'Не удалось удалить ключ';
      if (isAxiosError(error) && typeof error.response?.data?.error === 'string') {
        message = error.response.data.error;
      }
      addToast(message, 'error');
    } finally {
      setDeletingKeys((prev) => {
        const next = { ...prev };
        delete next[keyId];
        return next;
      });
    }
  }, [addToast, bucketNumber]);

  // Restore upload state and files from IndexedDB on component mount
  useEffect(() => {
    const restoreState = async () => {
      try {
        const savedFiles = await getFiles(bucketNumber);
        if (savedFiles.length > 0) {
          // Восстанавливаем файлы для загрузки
          const filesToResume = savedFiles.map(sf => new File([sf.data], sf.name, { type: sf.type }));
          const storageKey = `uploadState_bucket_${bucketNumber}`;
          const savedState = localStorage.getItem(storageKey);
          
          if (savedState) {
            try {
              const { uploadPath: savedPath } = JSON.parse(savedState);
              setUploadPath(savedPath || '');
            } catch (e) {
              console.error('Failed to restore upload path:', e);
            }
          }

          // Сохраняем файлы в state для отображения кнопки
          setResumedFiles(filesToResume);
          
          // Показываем уведомление о восстановленных файлах
          addToast(`⚠️ Обнаружено ${filesToResume.length} файла(ов) для восстановления. Нажмите "Продолжить загрузку" чтобы завершить.`, 'warning');
        }
      } catch (error) {
        console.error('Failed to restore upload state from IndexedDB:', error);
      }
    };

    restoreState();
  }, [bucketNumber, addToast]);

  // Poll for real-time bucket stats updates
  useEffect(() => {
    if (!bucketIdValid) {
      return;
    }

    const intervalId = setInterval(() => {
      fetchBucket({ silent: true });
    }, 15000); // Update every 15 seconds

    return () => clearInterval(intervalId);
  }, [bucketIdValid, fetchBucket]);

  useEffect(() => {
    if (!bucketIdValid) {
      setBucket(null);
      setBucketError('Некорректный идентификатор бакета');
      setBucketLoading(false);
      return;
    }

    setBucketError(null);
    setBucket(null);
    setObjects([]);
    setObjectsCursor(null);
    setSelectedKeys({});
    setObjectSearch('');
    setObjectPrefix('');
    objectPrefixRef.current = '';
    setLastCreatedKey(null);
    setConsoleCredentials((location.state as BucketLocationState | undefined)?.consoleCredentials ?? null);
    setConsoleCredentialsError(null);
    setConsoleCredentialsLoading(false);

    fetchBucket();
    loadObjects({ reset: true, prefix: '' });
    fetchAccessKeys();
  }, [bucketIdValid, fetchAccessKeys, fetchBucket, loadObjects, location.state]);

  const bucketUsagePercent = bucket ? getUsagePercent(bucket.usedBytes, bucket.quotaGb) : 0;
  const bucketPlanName = bucket?.planDetails?.name ?? bucket?.plan ?? '';
  const bucketPlanTone = getPlanTone(bucket?.planDetails?.code ?? bucket?.plan ?? '');
  const bucketStatusBadge = getStatusBadge(bucket?.status ?? '');
  const bucketPriceValue = bucket?.planDetails?.price ?? bucket?.monthlyPrice ?? null;
  const bucketPrice = typeof bucketPriceValue === 'number' && Number.isFinite(bucketPriceValue)
    ? formatCurrency(bucketPriceValue)
    : '—';
  const consoleLoginValue = consoleCredentials?.login ?? bucket?.consoleLogin ?? bucket?.name ?? '';
  const consoleLoginDisplay = consoleLoginValue || '—';
  const consoleUrl = consoleCredentials?.url ?? bucket?.consoleUrl ?? null;

  const activeTabMeta = TAB_ITEMS.find((item) => item.key === activeTab);

  let tabContent: React.ReactNode = null;

  if (bucket) {
    if (activeTab === 'summary') {
      tabContent = (
        <section className="bg-white rounded-xl shadow-md p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <p className="text-xs uppercase text-gray-500 mb-1">Регион</p>
              <p className="font-semibold text-gray-800">{bucket.regionDetails?.name ?? bucket.region}</p>
              <p className="text-xs text-gray-500">{bucket.regionDetails?.endpoint ?? bucket.regionDetails?.code ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500 mb-1">Класс хранения</p>
              <p className="font-semibold text-gray-800">{bucket.storageClassDetails?.name ?? bucket.storageClass}</p>
              <p className="text-xs text-gray-500">{bucket.storageClassDetails?.description ?? bucket.storageClassDetails?.code ?? '—'}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500 mb-1">Тариф</p>
              <p className="font-semibold text-gray-800">{bucketPlanName}</p>
              <p className="text-xs text-gray-500">Стоимость: {bucketPrice}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-gray-500 mb-1">Биллинг</p>
              <p className="font-semibold text-gray-800">Следующее списание: {formatDate(bucket.nextBillingDate)}</p>
              <p className="text-xs text-gray-500">Последнее списание: {formatDate(bucket.lastBilledAt)}</p>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm text-gray-600 mb-1">
              <span>Использовано: {formatBytes(bucket.usedBytes)}</span>
              <span>Квота: {bucket.quotaGb} GB</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all ${
                  bucketUsagePercent > 90 ? 'bg-red-500' : bucketUsagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
                }`}
                style={{ width: `${bucketUsagePercent}%` }}
              />
            </div>
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 mt-2">
              <span>{bucketUsagePercent.toFixed(1)}% квоты использовано</span>
              <span>Объектов: {bucket.objectCount}</span>
              <span>Синхронизация: {formatDate(bucket.usageSyncedAt, true)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm text-gray-600">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">Создан</p>
              <p className="font-semibold text-gray-800">{formatDate(bucket.createdAt)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">Обновлён</p>
              <p className="font-semibold text-gray-800">{formatDate(bucket.updatedAt, true)}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">Состояния</p>
              <div className="flex flex-wrap gap-2 mt-2">
                {bucket.public && (
                  <span className="inline-flex items-center px-2 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    Публичный доступ
                  </span>
                )}
                {bucket.versioning && (
                  <span className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-700 text-xs font-semibold rounded-full">
                    Версионирование
                  </span>
                )}
                {bucket.autoRenew && (
                  <span className="inline-flex items-center px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                    Автопродление
                  </span>
                )}
                {!bucket.public && !bucket.versioning && !bucket.autoRenew && (
                  <span className="text-xs text-gray-500">Опций нет</span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 text-sm text-blue-800">
            <FiHelpCircle className="text-lg" />
            <div>
              <p className="font-semibold">Нужна помощь по квотам или регионам?</p>
              <p>
                Ответы есть в <a href="https://ospab.host/faq/storage/overview" target="_blank" rel="noreferrer" className="underline font-semibold">FAQ по хранилищу</a>.
              </p>
            </div>
          </div>
        </section>
      );
    } else if (activeTab === 'files') {
      tabContent = (
        <section className="bg-white rounded-xl shadow-md p-6 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2">
              <form onSubmit={handleApplyFilter} className="flex flex-col gap-3 md:flex-row md:items-end">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Фильтр по префиксу</label>
                  <input
                    type="text"
                    value={objectSearch}
                    onChange={(event) => setObjectSearch(event.target.value)}
                    placeholder="Например: backups/2025"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-ospab-primary focus:outline-none"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-ospab-primary text-white rounded-lg text-sm font-semibold hover:bg-ospab-primary/90 transition"
                  >
                    Применить
                  </button>
                  <button
                    type="button"
                    onClick={handleResetFilter}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    Сбросить
                  </button>
                  <button
                    type="button"
                    onClick={() => loadObjects({ reset: true })}
                    className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                  >
                    <FiRefreshCw className={objectsLoading ? 'animate-spin' : ''} />
                    Обновить
                  </button>
                </div>
              </form>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Путь для загрузки</label>
              <input
                type="text"
                value={uploadPath}
                onChange={(event) => setUploadPath(event.target.value)}
                placeholder="Например: backups/april"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-ospab-primary focus:outline-none"
              />
              <p className="text-xs text-gray-500 mt-1">Префикс будет добавлен перед именем каждого файла.</p>
            </div>
          </div>

          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition ${
              isDragActive ? 'border-ospab-primary bg-ospab-primary/5' : 'border-gray-200 bg-gray-50'
            } ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
            onDrop={handleDropUpload}
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
          >
          <div className="flex flex-col items-center gap-3">
              <div className="bg-white w-12 h-12 rounded-full flex items-center justify-center shadow">
                <FiUpload className="text-ospab-primary text-xl" />
              </div>
              {resumedFiles.length > 0 ? (
                <>
                  <p className="text-sm text-gray-700 font-semibold text-orange-600">Прерванная загрузка</p>
                  <p className="text-xs text-gray-500">Восстановлено файлов: <span className="font-semibold">{resumedFiles.length}</span></p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        performUpload(resumedFiles);
                        setResumedFiles([]);
                      }}
                      disabled={uploading}
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition ${
                        uploading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700 cursor-pointer'
                      }`}
                    >
                      <FiUpload />
                      Продолжить загрузку
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setResumedFiles([]);
                        deleteFilesByBucket(bucketNumber).catch((e: unknown) => console.error('Failed to clear files:', e));
                      }}
                      disabled={uploading}
                      className="inline-flex items-center gap-2 px-6 py-3 rounded-lg text-sm font-semibold transition bg-gray-200 text-gray-700 hover:bg-gray-300 cursor-pointer"
                    >
                      Отменить
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-gray-700 font-semibold">Перетащите файлы сюда</p>
                  <p className="text-xs text-gray-500">или выберите вручную</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={handleClickSelectFiles}
                      disabled={uploading}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                        uploading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-ospab-primary text-white hover:bg-ospab-primary/90 cursor-pointer'
                      }`}
                    >
                      Выбрать файлы
                    </button>
                    <button
                      type="button"
                      onClick={handleClickSelectDirectory}
                      disabled={uploading}
                      className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition ${
                        uploading ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-700 cursor-pointer'
                      }`}
                    >
                      Выбрать папку
                    </button>
                  </div>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={handleUploadInput}
              />
              <input
                ref={directoryInputRef}
                type="file"
                multiple
                className="hidden"
                disabled={uploading}
                onChange={handleUploadDirectory}
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                {...({ webkitdirectory: '', mozdirectory: '' } as any)}
              />
            </div>
            {uploading && (
              <div className="mt-6 space-y-4 bg-ospab-primary/5 p-4 rounded-lg border border-ospab-primary/20">
                {uploadStats.currentFile && (
                  <div className="text-sm text-gray-700 font-semibold">
                    Загрузка файла {uploadStats.completedFiles + 1} из {uploadStats.totalFiles}: <span className="text-ospab-primary">{uploadStats.currentFile}</span>
                  </div>
                )}
                {Object.entries(uploadProgress).map(([fileName, progress]: [string, UploadProgress]) => {
                  const speedMB = (progress.speed / (1024 * 1024)).toFixed(2);
                  return (
                    <div key={fileName} className="space-y-2">
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-gray-600 truncate">{fileName}</span>
                        <span className="text-ospab-primary font-semibold whitespace-nowrap">
                          {progress.percentage}% • {speedMB} MB/s
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-ospab-primary h-full transition-all duration-300"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
                <button
                  onClick={handleCancelUpload}
                  className="mt-3 w-full px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition"
                >
                  Отменить загрузку
                </button>
              </div>
            )}
            {!uploading && Object.keys(uploadProgress).length === 0 && (
              <p className="text-xs text-gray-500 mt-3">Загружаем файлы...</p>
            )}
          </div>

          <div className="space-y-3">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <label className="block text-xs font-semibold text-gray-600 mb-2">Загрузка по URI</label>
              <div className="flex gap-2">
                <input
                  type="url"
                  value={uriUploadUrl}
                  onChange={(e) => setUriUploadUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && !uriUploadLoading && handleUriUpload()}
                  placeholder="https://example.com/file.zip"
                  className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-ospab-primary focus:outline-none"
                  disabled={uriUploadLoading || uploading}
                />
                {!uriUploadLoading ? (
                  <button
                    onClick={handleUriUpload}
                    disabled={uriUploadLoading || uploading || !uriUploadUrl.trim()}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition ${
                      uriUploadLoading || uploading || !uriUploadUrl.trim()
                        ? 'bg-gray-200 text-gray-500 cursor-not-allowed'
                        : 'bg-green-600 text-white hover:bg-green-700'
                    }`}
                  >
                    Загрузить
                  </button>
                ) : (
                  <button
                    onClick={handleCancelUriUpload}
                    className="px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                  >
                    Отменить
                  </button>
                )}
              </div>
              {uriUploadLoading && (
                <div className="mt-3 space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-600">Загрузка с сервера...</span>
                    <span className="text-gray-500">Подождите (может занять время)</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div className="bg-green-600 h-full animate-pulse" style={{ width: '100%' }} />
                  </div>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">Укажите прямую ссылку на файл для загрузки в бакет.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 items-center">
            <span className="text-sm text-gray-600">Найдено объектов: {objects.length}</span>
            {objectPrefix && (
              <span className="text-xs text-gray-500 bg-gray-100 px-3 py-1 rounded-full">Фильтр: {objectPrefix}</span>
            )}
            {selectedCount > 0 && (
              <span className="text-xs text-ospab-primary bg-ospab-primary/10 px-3 py-1 rounded-full">
                Выбрано объектов: {selectedCount}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSelectAll}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
              disabled={objects.length === 0}
            >
              {allSelected ? 'Снять выделение' : 'Выделить все'}
            </button>
            <button
              type="button"
              onClick={handleClearSelection}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
              disabled={selectedCount === 0}
            >
              Очистить выбор
            </button>
            <button
              type="button"
              onClick={handleDeleteObjects}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 rounded-lg text-sm font-semibold hover:bg-red-100 transition"
              disabled={selectedCount === 0}
            >
              <FiTrash2 />
              Удалить выбранные
            </button>
          </div>

          {objectsLoading ? (
            <div className="flex justify-center py-12">
              <FiRefreshCw className="text-2xl text-ospab-primary animate-spin" />
            </div>
          ) : objects.length === 0 ? (
            <div className="text-center text-sm text-gray-500 py-12">
              Объекты не найдены. Попробуйте изменить фильтр или загрузить новые файлы.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Выбор</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Ключ</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Размер</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Изменён</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {objects.map((object) => (
                    <tr key={object.key} className="hover:bg-gray-50">
                      <td className="px-4 py-2">
                        <input
                          type="checkbox"
                          checked={!!selectedKeys[object.key]}
                          onChange={() => handleToggleSelection(object.key)}
                        />
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-gray-700 break-all">{object.key}</td>
                      <td className="px-4 py-2 text-gray-600">{formatBytes(object.size)}</td>
                      <td className="px-4 py-2 text-gray-600">{object.lastModified ? formatDate(object.lastModified, true) : '—'}</td>
                      <td className="px-4 py-2">
                        <button
                          type="button"
                          onClick={() => handleDownloadObject(object)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                        >
                          <FiDownload />
                          Скачать
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {objectsCursor && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => loadObjects({ cursor: objectsCursor })}
                className="inline-flex items-center gap-2 px-6 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                disabled={objectsLoadingMore}
              >
                <FiRefreshCw className={objectsLoadingMore ? 'animate-spin' : ''} />
                Загрузить ещё
              </button>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3 text-sm text-blue-800">
            <FiHelpCircle className="text-lg" />
            <div>
              <p className="font-semibold">Как работает загрузка и скачивание?</p>
              <p>
                Подробные инструкции — в <a href="https://ospab.host/faq/storage/files" target="_blank" rel="noreferrer" className="underline font-semibold">FAQ по файлам</a>.
              </p>
            </div>
          </div>
        </section>
      );
    } else if (activeTab === 'settings') {
      tabContent = (
        <section className="bg-white rounded-xl shadow-md p-6 space-y-6">
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-start gap-3 text-sm text-gray-700">
            <FiHelpCircle className="text-lg text-ospab-primary" />
            <div>
              <p className="font-semibold">Управление доступом</p>
              <p>
                Рекомендации и best practices — в <a href="https://ospab.host/faq/storage/settings" target="_blank" rel="noreferrer" className="underline font-semibold">FAQ по настройкам бакета</a>.
              </p>
            </div>
          </div>

          <div className="border border-gray-200 rounded-xl p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Доступ к MinIO Console</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Здесь можно получить логин и временный пароль для панели управления объектным хранилищем.
                  Пароль показывается только один раз после генерации.
                </p>
              </div>
              <button
                type="button"
                onClick={handleGenerateConsoleCredentials}
                disabled={consoleCredentialsLoading || bucketActionPending || bucketLoading}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  consoleCredentialsLoading || bucketActionPending || bucketLoading
                    ? 'cursor-not-allowed bg-gray-200 text-gray-500'
                    : 'bg-ospab-primary text-white hover:bg-ospab-primary/90'
                }`}
              >
                {consoleCredentialsLoading ? <FiRefreshCw className="animate-spin" /> : <FiKey />}
                <span>{consoleCredentialsLoading ? 'Создаём...' : 'Сгенерировать пароль'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-3 items-center">
              <span className="font-mono text-xs text-gray-700">Логин: {consoleLoginDisplay}</span>
              {consoleLoginValue && (
                <button
                  type="button"
                  onClick={() => handleCopy(consoleLoginValue, 'Логин консоли')}
                  className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  <FiCopy />
                  Копировать
                </button>
              )}
              {consoleUrl && (
                <a
                  href={consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-ospab-primary hover:underline"
                >
                  Открыть MinIO Console
                </a>
              )}
            </div>

            {consoleCredentials && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <FiInfo />
                  Новые данные входа
                </div>
                <p className="text-xs text-green-700">
                  Скопируйте пароль сейчас. После закрытия страницы он больше не отобразится.
                </p>
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="font-mono text-xs text-green-900">Логин: {consoleCredentials.login}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(consoleCredentials.login, 'Логин консоли')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-green-200 rounded-lg text-xs font-semibold text-green-700 hover:bg-green-100"
                  >
                    <FiCopy />
                    Копировать
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="font-mono text-xs text-green-900">Пароль: {consoleCredentials.password}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(consoleCredentials.password, 'Пароль консоли')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 border border-green-200 rounded-lg text-xs font-semibold text-green-700 hover:bg-green-100"
                  >
                    <FiCopy />
                    Копировать
                  </button>
                </div>
              </div>
            )}

            {consoleCredentialsError && (
              <div className="text-xs text-red-600">
                {consoleCredentialsError}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Публичный доступ</h3>
                <p className="text-xs text-gray-500 mt-1">Позволяет отдавать файлы по прямым ссылкам без авторизации.</p>
              </div>
              <button
                type="button"
                onClick={togglePublic}
                disabled={bucketActionPending}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  bucketActionPending
                    ? 'opacity-60 cursor-not-allowed border-gray-200 text-gray-400'
                    : bucket.public
                      ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {bucketActionPending ? <FiRefreshCw className="animate-spin" /> : null}
                <span>{bucket.public ? 'Сделать приватным' : 'Сделать публичным'}</span>
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Версионирование</h3>
                <p className="text-xs text-gray-500 mt-1">Сохраняет историю изменений файлов, помогает откатиться при ошибках.</p>
              </div>
              <button
                type="button"
                onClick={toggleVersioning}
                disabled={bucketActionPending}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  bucketActionPending
                    ? 'opacity-60 cursor-not-allowed border-gray-200 text-gray-400'
                    : bucket.versioning
                      ? 'border-purple-200 bg-purple-50 text-purple-700 hover:bg-purple-100'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {bucketActionPending ? <FiRefreshCw className="animate-spin" /> : null}
                <span>{bucket.versioning ? 'Отключить версионирование' : 'Включить версионирование'}</span>
              </button>
            </div>

            <div className="border border-gray-200 rounded-xl p-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-800">Автопродление</h3>
                <p className="text-xs text-gray-500 mt-1">Продлевает подписку автоматически. Подходит для долгосрочных проектов.</p>
              </div>
              <button
                type="button"
                onClick={toggleAutoRenew}
                disabled={bucketActionPending}
                className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                  bucketActionPending
                    ? 'opacity-60 cursor-not-allowed border-gray-200 text-gray-400'
                    : bucket.autoRenew
                      ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {bucketActionPending ? <FiRefreshCw className="animate-spin" /> : null}
                <span>{bucket.autoRenew ? 'Отключить автопродление' : 'Включить автопродление'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">Текущий тариф</p>
              <p className="font-semibold text-gray-800">{bucketPlanName}</p>
              <p className="text-xs text-gray-500">Стоимость: {bucketPrice}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-xs uppercase text-gray-500 mb-1">Следующее списание</p>
              <p className="font-semibold text-gray-800">{formatDate(bucket.nextBillingDate)}</p>
              <p className="text-xs text-gray-500">Баланс списывается автоматически при продлении.</p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-ospab-primary/10 p-3 rounded-xl">
                  <FiKey className="text-ospab-primary text-xl" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Доступ по ключам</h2>
                  <p className="text-sm text-gray-500">Создавайте и управляйте access/secret ключами для приложений.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <input
                type="text"
                value={newKeyLabel}
                onChange={(event) => setNewKeyLabel(event.target.value)}
                placeholder="Название или назначение ключа"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-ospab-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={handleCreateAccessKey}
                className="inline-flex items-center gap-2 px-4 py-2 bg-ospab-primary text-white rounded-lg text-sm font-semibold hover:bg-ospab-primary/90 transition"
                disabled={creatingKey}
              >
                <FiKey />
                {creatingKey ? 'Создаём...' : 'Создать ключ'}
              </button>
            </div>

            {lastCreatedKey && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <FiInfo />
                  Сохраните данные нового ключа — после закрытия страницы секрет недоступен.
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="font-mono text-xs">Access Key: {lastCreatedKey.accessKey}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(lastCreatedKey.accessKey, 'Access Key')}
                    className="inline-flex items-center gap-1 px-2 py-1 border border-blue-200 rounded text-xs"
                  >
                    <FiCopy />
                    Копировать
                  </button>
                </div>
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="font-mono text-xs">Secret Key: {lastCreatedKey.secretKey}</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(lastCreatedKey.secretKey, 'Secret Key')}
                    className="inline-flex items-center gap-1 px-2 py-1 border border-blue-200 rounded text-xs"
                  >
                    <FiCopy />
                    Копировать
                  </button>
                </div>
              </div>
            )}

            {accessKeysLoading ? (
              <div className="flex justify-center py-8">
                <FiRefreshCw className="text-2xl text-ospab-primary animate-spin" />
              </div>
            ) : accessKeys.length === 0 ? (
              <div className="text-sm text-gray-500">Ключи доступа не созданы.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Название</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Access Key</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Создан</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Последнее использование</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500">Действия</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {accessKeys.map((key) => (
                      <tr key={key.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-700">{key.label || 'Без названия'}</td>
                        <td className="px-4 py-2 font-mono text-xs text-gray-700 break-all">{key.accessKey}</td>
                        <td className="px-4 py-2 text-gray-600">{formatDate(key.createdAt, true)}</td>
                        <td className="px-4 py-2 text-gray-600">{formatDate(key.lastUsedAt, true)}</td>
                        <td className="px-4 py-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => handleCopy(key.accessKey, 'Access Key')}
                              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600 hover:bg-gray-50"
                            >
                              <FiCopy />
                              Копировать
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRevokeAccessKey(key.id)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-semibold hover:bg-red-100"
                              disabled={deletingKeys[key.id]}
                            >
                              {deletingKeys[key.id] ? <FiRefreshCw className="animate-spin" /> : <FiTrash2 />}
                              Удалить
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      );
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <button
        type="button"
        onClick={() => navigate('/dashboard/storage')}
        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
      >
        <FiArrowLeft />
        Вернуться к списку бакетов
      </button>

      {bucketError && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 flex items-start gap-3">
          <FiInfo className="mt-0.5" />
          <div>
            <p className="font-semibold">{bucketError}</p>
            <p className="text-xs text-red-600">Попробуйте обновить страницу или вернитесь к списку хранилищ.</p>
          </div>
        </div>
      )}

      {bucketLoading ? (
        <div className="bg-white rounded-xl shadow-md p-12 flex justify-center">
          <FiRefreshCw className="text-3xl text-ospab-primary animate-spin" />
        </div>
      ) : bucket ? (
        <>
          <section className="bg-white rounded-xl shadow-md p-6 space-y-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-4">
                <div className="bg-ospab-primary/10 p-3 rounded-xl">
                  <FiDatabase className="text-ospab-primary text-2xl" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="text-2xl font-bold text-gray-800">{bucket.name}</h1>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${bucketPlanTone}`}>
                      {bucketPlanName}
                    </span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${bucketStatusBadge.className}`}>
                      {bucketStatusBadge.label}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">ID бакета: {bucket.id}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleRefreshBucket}
                  className="inline-flex items-center gap-2 px-4 py-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition"
                  disabled={bucketRefreshing || objectsLoading}
                >
                  <FiRefreshCw className={bucketRefreshing ? 'animate-spin' : ''} />
                  Обновить
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard/storage')}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-ospab-primary text-white rounded-lg font-semibold hover:bg-ospab-primary/90 transition"
                >
                  Назад к списку
                </button>
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-gray-500">
              <span>
                Регион: <span className="font-semibold text-gray-700">{bucket.regionDetails?.name ?? bucket.region}</span>
              </span>
              <span>
                Класс хранения: <span className="font-semibold text-gray-700">{bucket.storageClassDetails?.name ?? bucket.storageClass}</span>
              </span>
              <span>
                Объектов: <span className="font-semibold text-gray-700">{bucket.objectCount}</span>
              </span>
              <span>
                Квота: <span className="font-semibold text-gray-700">{bucket.quotaGb} GB</span>
              </span>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              {TAB_ITEMS.map(({ key, label, icon: Icon }) => {
                const isActive = key === activeTab;
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setActiveTab(key)}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition-colors ${
                      isActive
                        ? 'border-ospab-primary bg-ospab-primary text-white shadow'
                        : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className={isActive ? 'text-white' : 'text-ospab-primary'} />
                    {label}
                  </button>
                );
              })}
            </div>

            {activeTabMeta && (
              <p className="text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{activeTabMeta.label}:</span> {activeTabMeta.description}
              </p>
            )}
          </section>

          {tabContent}
        </>
      ) : (
        <div className="bg-white rounded-xl shadow-md p-12 text-center text-sm text-gray-500">
          Не удалось получить данные бакета. Обновите страницу или вернитесь к списку хранилищ.
        </div>
      )}
    </div>
  );
};

export default StorageBucketPage;
