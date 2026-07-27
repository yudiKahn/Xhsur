export type PrayerConditionRuleId =
  | 'show-tachanun'
  | 'show-hallel-any'
  | 'show-hallel-full'
  | 'show-hallel-partial'
  | 'IsSunday'
  | 'IsMonday'
  | 'IsTuesday'
  | 'IsWednesday'
  | 'IsThursday'
  | 'IsFriday'
  | 'IsSaturday';

export type HallelMode = 'none' | 'partial' | 'full';

export interface PrayerTimingFlags {
  tachanun: boolean;
  hallel: HallelMode;
  IsSunday: boolean;
  IsMonday: boolean;
  IsTuesday: boolean;
  IsWednesday: boolean;
  IsThursday: boolean;
  IsFriday: boolean;
  IsSaturday: boolean;
}

export interface PrayerPresetDefinition {
  id: string;
  titleKey: string;
  order: number;
  assetPath: string;
}

export type PrayerPresetSummary = PrayerPresetDefinition;
