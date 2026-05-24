export type PrayerConditionRuleId =
  | 'show-tachanun'
  | 'show-hallel-any'
  | 'show-hallel-full'
  | 'show-hallel-partial';

export type HallelMode = 'none' | 'partial' | 'full';
export type PrayerContentSourceFormat = 'html' | 'text';

export interface PrayerTimingFlags {
  tachanun: boolean;
  hallel: HallelMode;
}

export interface PrayerHtmlSectionDefinition {
  id: string;
  titleKey: string;
  assetPath: string;
  sourceFormat?: PrayerContentSourceFormat;
  documentSectionId?: string;
  startHeading?: string;
  endHeading?: string;
  includeWhen?: PrayerConditionRuleId;
}

export interface PrayerPresetSectionRef {
  sectionId: string;
  order: number;
  titleKey?: string;
  includeWhen?: PrayerConditionRuleId;
}

export interface PrayerPresetDefinition {
  id: string;
  titleKey: string;
  order: number;
  sections: PrayerPresetSectionRef[];
}

export interface ResolvedPrayerSection {
  id: string;
  titleKey: string;
  order: number;
  assetPath: string;
  sourceFormat: PrayerContentSourceFormat;
  documentSectionId?: string;
  startHeading?: string;
  endHeading?: string;
}

export interface ResolvedPrayerPreset {
  id: string;
  titleKey: string;
  order: number;
  sections: ResolvedPrayerSection[];
  initialSectionId: string;
}

export interface PrayerPresetSummary {
  id: string;
  titleKey: string;
  order: number;
  initialSectionId: string;
  sections: ResolvedPrayerSection[];
}
