import { Component, OnInit, inject, signal } from '@angular/core';
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
  IonSpinner,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import {
  informationCircleOutline,
  chevronDownOutline,
  menu,
  refreshOutline,
  settingsOutline,
} from 'ionicons/icons';
import { PrayerSectionDocument } from '../../models/prayer-content.model';
import { PrayerPresetSummary } from '../../models/prayer-preset.model';
import { DailyZmanim } from '../../models/daily-zmanim.model';
import { PrayerContentService } from '../../services/prayer-content.service';
import { JewishCalendarService } from '../../services/jewish-calendar.service';
import { LocationService } from '../../services/location.service';
import { PrayerPresetsService } from '../../services/prayer-presets.service';
import { ZmanimService } from '../../services/zmanim.service';

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
    IonSpinner,
    RouterLink,
    TranslatePipe,
  ],
})
export class HomePage implements OnInit {
  readonly currentDayLabel = inject(JewishCalendarService).getCurrentDayLabel();
  readonly zmanim = signal<DailyZmanim | null>(null);
  readonly zmanimError = signal(false);
  presets: PrayerPresetSummary[] = [];
  primaryPresets: PrayerPresetSummary[] = [];
  supplementalPresets: PrayerPresetSummary[] = [];
  readonly expandedPresetIds = signal<Set<string>>(new Set());
  readonly loadingSectionPresetIds = signal<Set<string>>(new Set());
  private readonly presetSections = new Map<string, PrayerSectionDocument[]>();
  private readonly prayerContentService = inject(PrayerContentService);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly locationService = inject(LocationService);
  private readonly zmanimService = inject(ZmanimService);
  private readonly router = inject(Router);
  private readonly primaryPresetIds = new Set(['shacharit', 'mincha', 'maariv']);

  constructor() {
    addIcons({
      'information-circle-outline': informationCircleOutline,
      'chevron-down-outline': chevronDownOutline,
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

  async togglePresetSections(preset: PrayerPresetSummary, event: MouseEvent): Promise<void> {
    event.stopPropagation();

    if (this.expandedPresetIds().has(preset.id)) {
      this.updateSetSignal(this.expandedPresetIds, preset.id, false);
      return;
    }

    let sections = this.presetSections.get(preset.id);
    if (!sections) {
      this.updateSetSignal(this.loadingSectionPresetIds, preset.id, true);
      try {
        const document = await this.prayerContentService.getPrayerDocument(preset.assetPath);
        sections = document.sections;
        this.presetSections.set(preset.id, sections);
      } catch {
        return;
      } finally {
        this.updateSetSignal(this.loadingSectionPresetIds, preset.id, false);
      }
    }

    if (sections?.length) this.updateSetSignal(this.expandedPresetIds, preset.id, true);
  }

  isPresetExpanded(presetId: string): boolean {
    return this.expandedPresetIds().has(presetId);
  }

  isLoadingPresetSections(presetId: string): boolean {
    return this.loadingSectionPresetIds().has(presetId);
  }

  getPresetSections(presetId: string): PrayerSectionDocument[] {
    return this.presetSections.get(presetId) ?? [];
  }

  openPresetSection(preset: PrayerPresetSummary, section: PrayerSectionDocument): void {
    this.navigateToPreset(preset, section.id);
  }

  openShiurim(): void {
    void this.router.navigateByUrl('/shiurim');
  }

  async loadZmanim(): Promise<void> {
    this.zmanimError.set(false);
    const location = this.locationService.currentLocation()
      ?? await this.locationService.loadCurrentLocation();

    if (!location) {
      this.zmanimError.set(true);
      return;
    }

    this.zmanim.set(this.zmanimService.calculate(location));
  }

  get isLoadingZmanim(): boolean {
    return this.locationService.isLoading();
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

  private updateSetSignal(
    target: typeof this.expandedPresetIds,
    value: string,
    enabled: boolean,
  ): void {
    const next = new Set(target());
    if (enabled) next.add(value);
    else next.delete(value);
    target.set(next);
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
