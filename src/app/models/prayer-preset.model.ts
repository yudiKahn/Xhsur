export type PrayerConditionRuleName =
  | 'show-tachanun'
  | 'show-hallel-any'
  | 'show-hallel-full'
  | 'show-hallel-partial'
  | 'IsSummer'
  | 'IsWinter'
  | 'IsWinter1'
  | 'IsWinter2'
  | 'IsSunday'
  | 'IsMonday'
  | 'IsTuesday'
  | 'IsWednesday'
  | 'IsThursday'
  | 'IsFriday'
  | 'IsSaturday';

export type PrayerConditionRuleId =
  | PrayerConditionRuleName
  | `!${PrayerConditionRuleName}`;

export type HallelMode = 'none' | 'partial' | 'full';

export interface PrayerTimingFlags {
  tachanun: boolean;
  hallel: HallelMode;
  IsSummer: boolean;
  IsWinter: boolean;
  IsWinter1: boolean;
  IsWinter2: boolean;
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
