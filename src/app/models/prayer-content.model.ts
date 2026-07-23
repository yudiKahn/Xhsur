import { PrayerConditionRuleId } from './prayer-preset.model';

export type PrayerBlockType = 'heading' | 'comment' | 'paragraph';

export interface PrayerTextSegment {
  text: string;
  size?: 'small';
}

export interface PrayerBlock {
  type: PrayerBlockType;
  text: string;
  segments?: PrayerTextSegment[];
  marker?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  conditions?: PrayerConditionRuleId[];
}

export interface PrayerSectionDocument {
  id: string;
  title: string;
  blocks: PrayerBlock[];
  conditions?: PrayerConditionRuleId[];
}

export interface PrayerDocument {
  id: string;
  title: string;
  sections: PrayerSectionDocument[];
}
