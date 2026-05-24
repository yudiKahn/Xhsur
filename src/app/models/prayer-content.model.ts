import { PrayerConditionRuleId } from './prayer-preset.model';

export type PrayerBlockType = 'heading' | 'comment' | 'paragraph';

export interface PrayerBlock {
  type: PrayerBlockType;
  text: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  conditions?: PrayerConditionRuleId[];
}

export interface PrayerSectionDocument {
  id: string;
  title: string;
  blocks: PrayerBlock[];
}

export interface PrayerDocument {
  id: string;
  sections: PrayerSectionDocument[];
}
