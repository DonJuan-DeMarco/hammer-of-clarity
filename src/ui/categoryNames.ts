import type { CategoryId } from '../core/types';
import type { MessageKey } from '../adapters/i18n';

export const CATEGORY_NAMES: Record<CategoryId, MessageKey> = {
  adult: 'categoryAdultName',
  gambling: 'categoryGamblingName',
  social: 'categorySocialName',
  'short-video': 'categoryShortVideoName',
  personal: 'categoryPersonalName',
};
