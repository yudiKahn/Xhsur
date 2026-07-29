import { Injectable } from '@angular/core';
import { AppTheme, READER_FONT_SCALE_MAX, READER_FONT_SCALE_MIN } from '../models/app-settings.model';

const STORAGE_KEYS = {
  theme: 'siddur.theme',
  readerFontScale: 'siddur.readerFontScale',
  keepScreenOn: 'siddur.keepScreenOn',
} as const;

@Injectable({ providedIn: 'root' })
export class SettingsStorageService {
  get theme(): AppTheme {
    const value = this.getItem(STORAGE_KEYS.theme);
    return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
  }

  set theme(value: AppTheme) {
    this.setItem(STORAGE_KEYS.theme, value);
  }

  get readerFontScale(): number {
    const value = Number(this.getItem(STORAGE_KEYS.readerFontScale));
    return Number.isFinite(value)
      ? Math.min(READER_FONT_SCALE_MAX, Math.max(READER_FONT_SCALE_MIN, value))
      : 1;
  }

  set readerFontScale(value: number) {
    this.setItem(STORAGE_KEYS.readerFontScale, String(value));
  }

  get keepScreenOn(): boolean {
    return this.getItem(STORAGE_KEYS.keepScreenOn) === 'true';
  }

  set keepScreenOn(value: boolean) {
    this.setItem(STORAGE_KEYS.keepScreenOn, String(value));
  }

  private getItem(key: string): string | null {
    try {
      return globalThis.localStorage?.getItem(key) ?? null;
    } catch {
      return null;
    }
  }

  private setItem(key: string, value: string): void {
    try {
      globalThis.localStorage?.setItem(key, value);
    } catch {
      // Settings still work for this session when storage is unavailable.
    }
  }
}
