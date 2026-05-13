import { Injectable } from '@angular/core';
import { PRAYER_PRESETS } from '../data/prayer-presets.data';
import { PrayerPreset, PrayerSubPreset } from '../models/prayer-preset.model';

const sortSubPresets = (subPresets: PrayerSubPreset[]): PrayerSubPreset[] =>
  [...subPresets].sort((left, right) => left.order - right.order);

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
