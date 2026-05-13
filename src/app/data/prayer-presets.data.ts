import { PrayerPreset, PrayerSubPreset } from '../models/prayer-preset.model';

const sortSubPresets = (subPresets: PrayerSubPreset[]): PrayerSubPreset[] =>
  [...subPresets].sort((left, right) => left.order - right.order);

export const PRAYER_PRESETS: PrayerPreset[] = [
  {
    id: 'shacharit',
    titleKey: 'presets.shacharit.title',
    startPage: 6,
    endPage: 86,
    order: 1,
    subPresets: sortSubPresets([
      {
        id: 'birkot-hashachar',
        titleKey: 'presets.shacharit.sections.birkotHashachar',
        startPage: 6,
        order: 1,
      },
      {
        id: 'korbanot',
        titleKey: 'presets.shacharit.sections.korbanot',
        startPage: 18,
        order: 2,
      },
      {
        id: 'hodu',
        titleKey: 'presets.shacharit.sections.hodu',
        startPage: 27,
        order: 3,
      },
      {
        id: 'yishtabach',
        titleKey: 'presets.shacharit.sections.yishtabach',
        startPage: 41,
        order: 4,
      },
    ]),
  },
  {
    id: 'mincha',
    titleKey: 'presets.mincha.title',
    startPage: 96,
    endPage: 106,
    order: 2,
  },
  {
    id: 'birkat-hamazon',
    titleKey: 'presets.birkatHamazon.title',
    startPage: 88,
    endPage: 94,
    order: 3,
  },
  {
    id: 'tefilat-haderech',
    titleKey: 'presets.tefilatHaderech.title',
    startPage: 86,
    endPage: 86,
    order: 4,
  },
  {
    id: 'maariv',
    titleKey: 'presets.maariv.title',
    startPage: 106,
    endPage: 118,
    order: 5,
  },
  {
    id: 'kriat-shema-al-hamita',
    titleKey: 'presets.kriatShemaAlHamita.title',
    startPage: 118,
    endPage: 124,
    order: 6,
  },
];
