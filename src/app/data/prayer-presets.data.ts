import { PrayerPresetDefinition } from '../models/prayer-preset.model';

export const PRAYER_PRESETS: PrayerPresetDefinition[] = [
  {
    id: 'shacharit',
    titleKey: 'presets.shacharit.title',
    order: 1,
    assetPath: 'assets/siddur/shacharit.md',
  },
  {
    id: 'mincha',
    titleKey: 'presets.mincha.title',
    order: 2,
    assetPath: 'assets/siddur/mincha.md',
  },
  {
    id: 'birkat-hamazon',
    titleKey: 'presets.birkatHamazon.title',
    order: 3,
    assetPath: 'assets/siddur/birkat-hamazon.md',
  },
  {
    id: 'tefilat-haderech',
    titleKey: 'presets.tefilatHaderech.title',
    order: 4,
    assetPath: 'assets/siddur/tfilat-haderch.md',
  },
  {
    id: 'maariv',
    titleKey: 'presets.maariv.title',
    order: 5,
    assetPath: 'assets/siddur/mhariv.md',
  },
  {
    id: 'kryat-shema',
    titleKey: 'presets.kriatShemaAlHamita.title',
    order: 5,
    assetPath: 'assets/siddur/kryat-shema.md',
  },
];
