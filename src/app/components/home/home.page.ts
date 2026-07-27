import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  IonContent,
  IonIcon,
  IonHeader,
  IonToolbar,
  IonButtons,
  IonButton,
  IonPopover,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import {
  informationCircleOutline,
  menu,
  refreshOutline,
  settingsOutline,
} from 'ionicons/icons';
import { PrayerPresetSummary } from '../../models/prayer-preset.model';
import { PrayerContentService } from '../../services/prayer-content.service';
import { JewishCalendarService } from '../../services/jewish-calendar.service';
import { PrayerPresetsService } from '../../services/prayer-presets.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    IonHeader,
    IonToolbar,
    IonButtons,
    IonButton,
    IonPopover,
    IonList,
    IonItem,
    IonLabel,
    RouterLink,
    TranslatePipe,
  ],
})
export class HomePage implements OnInit {
  readonly currentDayLabel = inject(JewishCalendarService).getCurrentDayLabel();
  presets: PrayerPresetSummary[] = [];
  primaryPresets: PrayerPresetSummary[] = [];
  supplementalPresets: PrayerPresetSummary[] = [];
  private readonly prayerContentService = inject(PrayerContentService);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly router = inject(Router);
  private readonly primaryPresetIds = new Set(['shacharit', 'mincha', 'maariv']);

  constructor() {
    addIcons({
      'information-circle-outline': informationCircleOutline,
      'menu': menu,
      'refresh-outline': refreshOutline,
      'settings-outline': settingsOutline,
    });
  }

  ngOnInit(): void {
    this.presets = this.prayerPresetsService.getAll();
    this.primaryPresets = this.presets.filter((preset) => this.primaryPresetIds.has(preset.id));
    this.supplementalPresets = this.presets.filter((preset) => !this.primaryPresetIds.has(preset.id));
  }

  async openPreset(
    preset: PrayerPresetSummary,
  ): Promise<void> {
    const document = await this.prayerContentService.getPrayerDocument(preset.assetPath);
    const firstSection = document.sections[0];
    this.navigateToPreset(preset, firstSection?.id, document.sections.length > 1);
  }

  trackByPreset(index: number, preset: PrayerPresetSummary): string {
    return preset.id;
  }

  getPresetIcon(presetId: string): string {
    switch (presetId) {
      case 'shacharit':
        return 'assets/icons/morning.svg';
      case 'mincha':
        return 'assets/icons/noon.svg';
      case 'tefilat-haderech':
        return 'assets/icons/road.svg';
      case 'maariv':
        return 'assets/icons/evening.svg';
      case 'birkat-hamazon':
        return 'assets/icons/bread.svg';
      case 'kryat-shema':
        return 'assets/icons/night.svg';
      default:
        return 'assets/icons/noon.svg';
    }
  }

  private navigateToPreset(
    preset: PrayerPresetSummary,
    sectionId?: string,
    openSectionMenu = false,
  ): void {
    void this.router.navigate(['/reader', preset.id], {
      queryParams: {
        ...(sectionId ? { section: sectionId } : {}),
        ...(openSectionMenu ? { openSectionMenu: true } : {}),
      },
    });
  }

  async refreshApp(): Promise<void> {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((cacheName) => window.caches.delete(cacheName)));
    }

    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }

    window.location.reload();
  }
}
