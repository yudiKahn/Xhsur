import { Component, inject } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonNote,
  IonRange,
  IonSegment,
  IonSegmentButton,
  IonTitle,
  IonToggle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import packageJson from '../../../../package.json';
import { AppTheme, READER_FONT_SCALE_MAX, READER_FONT_SCALE_MIN, READER_FONT_SCALE_STEP } from '../../models/app-settings.model';
import { AppSettingsService } from '../../services/app-settings.service';

@Component({
  selector: 'app-settings',
  templateUrl: './settings.page.html',
  styleUrls: ['./settings.page.scss'],
  standalone: true,
  imports: [
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonListHeader,
    IonNote,
    IonRange,
    IonSegment,
    IonSegmentButton,
    IonTitle,
    IonToggle,
    IonToolbar,
    DecimalPipe,
    TranslatePipe,
  ],
})
export class SettingsPage {
  readonly version = packageJson.version;
  readonly settings = inject(AppSettingsService);
  readonly minimumFontScale = READER_FONT_SCALE_MIN;
  readonly maximumFontScale = READER_FONT_SCALE_MAX;
  readonly fontScaleStep = READER_FONT_SCALE_STEP;

  setTheme(event: Event): void {
    const theme = (event as CustomEvent<{ value?: string | number }>).detail.value;
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      this.settings.setTheme(theme as AppTheme);
    }
  }

  setFontScale(event: CustomEvent<{ value: number | { lower: number; upper: number } }>): void {
    const value = event.detail.value;
    if (typeof value === 'number') this.settings.setReaderFontScale(value);
  }

  async setKeepScreenOn(event: CustomEvent<{ checked: boolean }>): Promise<void> {
    const toggle = event.target as HTMLIonToggleElement;
    toggle.disabled = true;
    const succeeded = await this.settings.setKeepScreenOn(event.detail.checked);
    if (!succeeded) toggle.checked = this.settings.keepScreenOn();
    toggle.disabled = !this.settings.keepAwakeSupported();
  }
}
