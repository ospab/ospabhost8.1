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
  createdAt: string;
  updatedAt: string;
}

export interface UserData {
  user: User;
  balance: number;
  tickets: Ticket[];
}