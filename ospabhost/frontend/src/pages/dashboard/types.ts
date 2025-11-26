export interface User {
  id?: number;
  username: string;
  email?: string;
  operator: number;
  isAdmin?: boolean;
  balance?: number;
  tickets?: Ticket[];
  buckets?: StorageBucket[];
}

export interface Ticket {
  id: number;
  title: string;
  message: string;
  status: string;
  createdAt: string;
  responses: unknown[];
  user?: { username: string };
}

export interface StorageBucket {
  id: number;
  name: string;
  plan: string;
  quotaGb: number;
  usedBytes: number;
  objectCount: number;
  storageClass: string;
  region: string;
  public: boolean;
  versioning: boolean;
  status: string;
  monthlyPrice: number;
  autoRenew: boolean;
  createdAt: string;
  updatedAt: string;
  nextBillingDate?: string | null;
  lastBilledAt?: string | null;
  usageSyncedAt?: string | null;
  consoleLogin?: string | null;
  planDetails?: {
    id: number;
    code: string;
    name: string;
    price: number;
    quotaGb: number;
    bandwidthGb: number;
    requestLimit: string;
    description: string | null;
    order: number;
    isActive: boolean;
  } | null;
  regionDetails?: {
    code: string;
    name: string;
    description: string | null;
    endpoint: string | null;
    isDefault: boolean;
    isActive: boolean;
  } | null;
  storageClassDetails?: {
    code: string;
    name: string;
    description: string | null;
    redundancy: string | null;
    performance: string | null;
    retrievalFee: string | null;
    isDefault: boolean;
    isActive: boolean;
  } | null;
  consoleUrl?: string | null;
}

export interface StorageObject {
  key: string;
  size: number;
  etag?: string;
  lastModified?: string;
}

export interface StorageAccessKey {
  id: number;
  accessKey: string;
  label?: string | null;
  createdAt: string;
  lastUsedAt?: string | null;
}

export interface UserData {
  user: User;
  balance: number;
  tickets: Ticket[];
}