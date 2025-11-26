// IndexedDB utilities for persistent file uploads

export interface StoredFile {
  id: string;
  bucketId: number;
  name: string;
  size: number;
  type: string;
  data: ArrayBuffer;
  uploadPath: string;
  timestamp: number;
}

const DB_NAME = 'OspabStorageUpload';
const DB_VERSION = 1;
const STORE_NAME = 'files';

let db: IDBDatabase | null = null;

export const initDB = async (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('bucketId', 'bucketId', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
};

export const getDB = async (): Promise<IDBDatabase> => {
  if (!db) {
    db = await initDB();
  }
  return db;
};

export const saveFile = async (file: StoredFile): Promise<void> => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(file);

    request.onerror = () => {
      reject(new Error('Failed to save file'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
};

export const getFiles = async (bucketId: number): Promise<StoredFile[]> => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('bucketId');
    const request = index.getAll(bucketId);

    request.onerror = () => {
      reject(new Error('Failed to get files'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
};

export const getFile = async (fileId: string): Promise<StoredFile | undefined> => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(fileId);

    request.onerror = () => {
      reject(new Error('Failed to get file'));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };
  });
};

export const deleteFile = async (fileId: string): Promise<void> => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(fileId);

    request.onerror = () => {
      reject(new Error('Failed to delete file'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
};

export const deleteFilesByBucket = async (bucketId: number): Promise<void> => {
  const files = await getFiles(bucketId);
  for (const file of files) {
    await deleteFile(file.id);
  }
};

export const clearAllFiles = async (): Promise<void> => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onerror = () => {
      reject(new Error('Failed to clear files'));
    };

    request.onsuccess = () => {
      resolve();
    };
  });
};
