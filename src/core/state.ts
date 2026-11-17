import type { CategoryId, CategoryState, State } from './types';

const CATEGORY_IDS: CategoryId[] = ['adult', 'gambling', 'social', 'short-video', 'personal'];

const emptyCategory = (): CategoryState => ({ enabled: false, exceptions: [], graduationAnnounced: false });

export function initialState(): State {
  return {
    schemaVersion: 1,
    onboardingComplete: false,
    categories: Object.fromEntries(CATEGORY_IDS.map((id) => [id, emptyCategory()])) as Record<CategoryId, CategoryState>,
    blocks: [],
    removalRequests: [],
    redirects: [],
    attempts: [],
    lists: { refreshEnabled: true },
    incognitoWasAllowed: false,
  };
}
