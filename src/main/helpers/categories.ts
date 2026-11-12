import type { Section } from '../model/index.ts';

// The award category shown to people. "both" awards count film and TV.
export const CATEGORY_NAMES: Record<Section, string> = {
    film: 'Film',
    tv: 'Television',
    both: 'Screen',
};
