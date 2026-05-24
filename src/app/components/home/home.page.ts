import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { informationCircleOutline } from 'ionicons/icons';
import {
  ActionSheetButton,
  ActionSheetController,
  IonButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonIcon,
  IonItem,
  IonLabel,
  IonList,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PrayerPresetSummary, ResolvedPrayerSection } from '../../models/prayer-preset.model';
import { PrayerPresetsService } from '../../services/prayer-presets.service';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonIcon,
    IonItem,
    IonLabel,
    IonList,
    IonTitle,
    IonToolbar,
    RouterLink,
    TranslatePipe,
  ],
})
export class HomePage implements OnInit {
  presets: PrayerPresetSummary[] = [];
  primaryPresets: PrayerPresetSummary[] = [];
  supplementalPresets: PrayerPresetSummary[] = [];
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private readonly primaryPresetIds = new Set(['shacharit', 'mincha', 'maariv']);

  constructor() {
    addIcons({
      'information-circle-outline': informationCircleOutline,
    });
  }

  ngOnInit(): void {
    this.presets = this.prayerPresetsService.getAll();
    this.primaryPresets = this.presets.filter((preset) => this.primaryPresetIds.has(preset.id));
    this.supplementalPresets = this.presets.filter((preset) => !this.primaryPresetIds.has(preset.id));
  }

  async openPreset(
    preset: PrayerPresetSummary,
    sectionId?: string,
  ): Promise<void> {
    if (!sectionId && preset.sections.length > 1) {
      await this.presentSubPresets(preset);
      return;
    }

    this.navigateToPreset(preset, sectionId);
  }

  trackByPreset(index: number, preset: PrayerPresetSummary): string {
    return preset.id;
  }

  private navigateToPreset(
    preset: PrayerPresetSummary,
    sectionId?: string,
  ): void {
    void this.router.navigate(['/reader', preset.id], {
      queryParams: sectionId ? { section: sectionId } : {},
    });
  }

  private async presentSubPresets(preset: PrayerPresetSummary): Promise<void> {
    const sections = preset.sections;
    if (!sections.length) {
      this.navigateToPreset(preset);
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      buttons: [
        ...sections.map((section) => this.toActionSheetButton(preset, section)),
      ],
    });

    await actionSheet.present();
  }

  private toActionSheetButton(
    preset: PrayerPresetSummary,
    section: ResolvedPrayerSection,
  ): ActionSheetButton {
    return {
      text: this.translateService.instant(section.titleKey),
      handler: () => {
        this.navigateToPreset(preset, section.id);
      },
    };
  }
}
