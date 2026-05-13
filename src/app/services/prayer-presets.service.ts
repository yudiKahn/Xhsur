import { Injectable } from '@angular/core';
import { PrayerPreset, PrayerSubPreset } from '../models/prayer-preset.model';

const sortSubPresets = (subPresets: PrayerSubPreset[]): PrayerSubPreset[] =>
  [...subPresets].sort((left, right) => left.order - right.order);

const PRAYER_PRESETS: PrayerPreset[] = [
  {
    id: 'shacharit',
    titleHe: 'שחרית',
    titleEn: 'Shacharit',
    startPage: 6,
    endPage: 86,
    order: 1,
    subPresets: sortSubPresets([
      {
        id: 'birkot-hashachar',
        titleHe: 'ברכות השחר',
        titleEn: 'Birkot Hashachar',
        startPage: 6,
        order: 1,
      },
      {
        id: 'korbanot',
        titleHe: 'קרבנות',
        titleEn: 'Korbanot',
        startPage: 18,
        order: 2,
      },
      {
        id: 'hodu',
        titleHe: 'הודו',
        titleEn: 'Hodu',
        startPage: 27,
        order: 3,
      },
      {
        id: 'yishtabach',
        titleHe: 'ישתבח',
        titleEn: 'Yishtabach',
        startPage: 41,
        order: 4,
      },
    ]),
  },
  {
    id: 'mincha',
    titleHe: 'מנחה',
    titleEn: 'Mincha',
    startPage: 96,
    endPage: 106,
    order: 2,
  },
  {
    id: 'birkat-hamazon',
    titleHe: 'ברכת המזון',
    titleEn: 'Birkat Hamazon',
    startPage: 88,
    endPage: 94,
    order: 3,
  },
  {
    id: 'tefilat-haderech',
    titleHe: 'תפילת הדרך',
    titleEn: 'Tefilat Haderech',
    startPage: 86,
    endPage: 86,
    order: 4,
  },
  {
    id: 'maariv',
    titleHe: 'ערבית',
    titleEn: 'Maariv',
    startPage: 106,
    endPage: 118,
    order: 5,
  },
  {
    id: 'kriat-shema-al-hamita',
    titleHe: 'קריאת שמע שעל המיטה',
    titleEn: 'Kriat Shema Al Hamita',
    startPage: 118,
    endPage: 124,
    order: 6,
  },
];

@Injectable({
  providedIn: 'root',
})
export class PrayerPresetsService {
  getAll(): PrayerPreset[] {
    return [...PRAYER_PRESETS]
      .sort((left, right) => left.order - right.order)
      .map((preset) => ({
        ...preset,
        subPresets: preset.subPresets ? sortSubPresets(preset.subPresets) : undefined,
      }));
  }

  getById(id: string): PrayerPreset | undefined {
    const preset = PRAYER_PRESETS.find((entry) => entry.id === id);
    if (!preset) {
      return undefined;
    }

    return {
      ...preset,
      subPresets: preset.subPresets ? sortSubPresets(preset.subPresets) : undefined,
    };
  }
}
