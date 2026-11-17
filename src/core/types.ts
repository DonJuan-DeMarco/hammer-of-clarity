/** Shapes from SPEC §4. Fields later tickets use are typed now so storage never needs migrating for them. */

export type CategoryId = 'adult' | 'gambling' | 'social' | 'short-video' | 'personal';

export interface State {
  schemaVersion: 1;
  onboardingComplete: boolean;
  categories: Record<CategoryId, CategoryState>;
  blocks: Block[];
  removalRequests: RemovalRequest[];
  redirects: Redirect[];
  attempts: Attempt[];
  lists: ListMeta;
  incognitoWasAllowed: boolean;
}

export interface CategoryState {
  enabled: boolean;
  reason?: string;
  stageStartedAt?: number;
  exceptions: Exception[];
  graduatedAt?: number;
  graduationAnnounced: boolean;
  /** Set by a reset; cleared once the gentle reset message has been shown (D10). */
  resetNoticePending?: boolean;
}

/** A hand-added block. All of them belong to the `personal` category (D31). */
export interface Block {
  id: string;
  domain: string;
  pathPrefix?: string;
  reason?: string;
  createdAt: number;
}

export interface Exception {
  domain: string;
  pathPrefix?: string;
  addedAt: number;
}

export type RemovalTarget =
  | { kind: 'category'; category: CategoryId }
  | { kind: 'block'; blockId: string }
  | { kind: 'exception'; category: CategoryId; domain: string; pathPrefix?: string };

export interface RemovalRequest {
  id: string;
  target: RemovalTarget;
  createdAt: number;
  readyAt: number;
  expiresAt: number;
  confirmText: string;
}

export interface Redirect {
  id: string;
  kind: 'link' | 'instruction';
  text: string;
  url?: string;
}

export interface Attempt {
  category: CategoryId;
  at: number;
}

export interface ListMeta {
  refreshEnabled: boolean;
  lastRefreshedAt?: number;
}
