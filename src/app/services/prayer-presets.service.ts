import { Injectable } from '@angular/core';
import { PRAYER_PRESETS } from '../data/prayer-presets.data';
import { PrayerPresetSummary } from '../models/prayer-preset.model';

@Injectable({
  providedIn: 'root',
})
export class PrayerPresetsService {
  getAll(): PrayerPresetSummary[] {
    return [...PRAYER_PRESETS].sort((left, right) => left.order - right.order);
  }

  getById(presetId: string): PrayerPresetSummary | undefined {
    return PRAYER_PRESETS.find((preset) => preset.id === presetId);
  }
}
