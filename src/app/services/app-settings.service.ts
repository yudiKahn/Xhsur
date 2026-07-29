import { DOCUMENT } from '@angular/common';
import { Injectable, inject, signal } from '@angular/core';
import { KeepAwake } from '@capacitor-community/keep-awake';
import {
  AppTheme,
  READER_FONT_SCALE_MAX,
  READER_FONT_SCALE_MIN,
} from '../models/app-settings.model';
import { SettingsStorageService } from './settings-storage.service';

@Injectable({ providedIn: 'root' })
export class AppSettingsService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(SettingsStorageService);
  private readonly systemTheme = globalThis.matchMedia?.('(prefers-color-scheme: dark)');

  readonly theme = signal<AppTheme>(this.storage.theme);
  readonly readerFontScale = signal(this.storage.readerFontScale);
  readonly keepScreenOn = signal(this.storage.keepScreenOn);
  readonly keepAwakeSupported = signal(true);

  constructor() {
    this.applyTheme();
    this.systemTheme?.addEventListener('change', this.onSystemThemeChange);
    void this.initializeKeepAwake();
  }

  setTheme(theme: AppTheme): void {
    this.theme.set(theme);
    this.storage.theme = theme;
    this.applyTheme();
  }

  setReaderFontScale(scale: number): void {
    const clampedScale = Math.min(READER_FONT_SCALE_MAX, Math.max(READER_FONT_SCALE_MIN, scale));
    const normalizedScale = Math.round(clampedScale * 100) / 100;
    this.readerFontScale.set(normalizedScale);
    this.storage.readerFontScale = normalizedScale;
  }

  async setKeepScreenOn(enabled: boolean): Promise<boolean> {
    try {
      if (enabled) {
        await KeepAwake.keepAwake();
      } else {
        await KeepAwake.allowSleep();
      }

      this.keepScreenOn.set(enabled);
      this.storage.keepScreenOn = enabled;
      return true;
    } catch {
      this.keepAwakeSupported.set(false);
      return false;
    }
  }

  private readonly onSystemThemeChange = (): void => {
    if (this.theme() === 'system') this.applyTheme();
  };

  private applyTheme(): void {
    const isDark = this.theme() === 'dark'
      || (this.theme() === 'system' && this.systemTheme?.matches === true);
    this.document.documentElement.classList.toggle('app-dark-theme', isDark);
    this.document.documentElement.style.colorScheme = isDark ? 'dark' : 'light';
  }

  private async initializeKeepAwake(): Promise<void> {
    try {
      const { isSupported } = await KeepAwake.isSupported();
      this.keepAwakeSupported.set(isSupported);
      if (isSupported && this.keepScreenOn()) await KeepAwake.keepAwake();
    } catch {
      this.keepAwakeSupported.set(false);
    }
  }
}
