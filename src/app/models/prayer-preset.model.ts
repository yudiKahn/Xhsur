export interface PrayerSubPreset {
  id: string;
  titleKey: string;
  startPage: number;
  order: number;
}

export interface PrayerPreset {
  id: string;
  titleKey: string;
  startPage: number;
  endPage: number;
  order: number;
  subPresets?: PrayerSubPreset[];
}
