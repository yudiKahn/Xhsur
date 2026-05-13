export interface PrayerSubPreset {
  id: string;
  titleHe: string;
  titleEn?: string;
  startPage: number;
  order: number;
}

export interface PrayerPreset {
  id: string;
  titleHe: string;
  titleEn?: string;
  startPage: number;
  endPage: number;
  order: number;
  subPresets?: PrayerSubPreset[];
}
