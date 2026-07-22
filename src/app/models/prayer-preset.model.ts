export type PrayerConditionRuleId =
  | 'show-tachanun'
  | 'show-hallel-any'
  | 'show-hallel-full'
  | 'show-hallel-partial';

export type HallelMode = 'none' | 'partial' | 'full';

export interface PrayerTimingFlags {
  tachanun: boolean;
  hallel: HallelMode;
}

export interface PrayerPresetDefinition {
  id: string;
  titleKey: string;
  order: number;
  assetPath: string;
}

export type PrayerPresetSummary = PrayerPresetDefinition;
