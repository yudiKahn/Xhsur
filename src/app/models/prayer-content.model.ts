import { PrayerCondition } from './prayer-preset.model';

export type PrayerBlockType = 'heading' | 'comment' | 'paragraph';

export interface PrayerTextSegment {
  text: string;
  size?: 'small';
  conditions?: PrayerCondition[];
}

export interface PrayerBlock {
  type: PrayerBlockType;
  text: string;
  size?: 'small';
  segments?: PrayerTextSegment[];
  marker?: string;
  level?: 1 | 2 | 3 | 4 | 5 | 6;
  conditions?: PrayerCondition[];
}

export interface PrayerSectionDocument {
  id: string;
  title: string;
  blocks: PrayerBlock[];
  conditions?: PrayerCondition[];
}

export interface PrayerDocument {
  id: string;
  title: string;
  sections: PrayerSectionDocument[];
}
