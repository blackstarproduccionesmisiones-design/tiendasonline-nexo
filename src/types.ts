import type { Timestamp } from 'firebase/firestore';

export type BackgroundTexture = 'none' | 'dots' | 'grid' | 'diagonal' | 'grain' | 'carbon';

export interface Store {
  id: string;
  slug: string;
  name: string;
  description?: string;
  whatsapp: string;
  address?: string;
  hours?: string;
  bannerUrl?: string;
  logoUrl?: string;
  appIconUrl?: string;
  accentColor?: string;
  backgroundColor?: string;
  backgroundTexture?: BackgroundTexture;
  backgroundImageUrl?: string;
  isActive: boolean;
  ownerUid: string;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
  isDemo?: boolean;
}

export interface StoreAccount {
  storeId: string;
  ownerUid: string;
  ownerEmail: string;
  createdAt?: Timestamp | string;
}

export interface Category {
  id: string;
  storeId: string;
  ownerUid: string;
  name: string;
  description?: string;
  order: number;
  isAvailable: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface Product {
  id: string;
  storeId: string;
  ownerUid: string;
  categoryId: string;
  name: string;
  description?: string;
  price: number;
  imageUrl?: string;
  isAvailable: boolean;
  featured?: boolean;
  createdAt?: Timestamp | string;
  updatedAt?: Timestamp | string;
}

export interface CartItem {
  product: Product;
  quantity: number;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}
