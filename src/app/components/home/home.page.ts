import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { addIcons } from 'ionicons';
import { informationCircleOutline } from 'ionicons/icons';
import {
  ActionSheetButton,
  ActionSheetController,
  IonContent,
  IonIcon,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { PrayerSectionDocument } from '../../models/prayer-content.model';
import { PrayerPresetSummary } from '../../models/prayer-preset.model';
import { PrayerContentService } from '../../services/prayer-content.service';
import { PrayerPresetsService } from '../../services/prayer-presets.service';

@Component({
  selector: 'app-home',
  templateUrl: './home.page.html',
  styleUrls: ['./home.page.scss'],
  standalone: true,
  imports: [
    IonContent,
    IonIcon,
    RouterLink,
    TranslatePipe,
  ],
})
export class HomePage implements OnInit {
  presets: PrayerPresetSummary[] = [];
  primaryPresets: PrayerPresetSummary[] = [];
  supplementalPresets: PrayerPresetSummary[] = [];
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly prayerContentService = inject(PrayerContentService);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly router = inject(Router);
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
    if (!sectionId) {
      const document = await this.prayerContentService.getPrayerDocument(preset.assetPath);
      if (document.sections.length > 1) {
        await this.presentSubPresets(preset, document.sections);
        return;
      }
    }

    this.navigateToPreset(preset, sectionId);
  }

  private async presentSubPresets(
    preset: PrayerPresetSummary,
    sections: PrayerSectionDocument[],
  ): Promise<void> {
    if (!sections.length) {
      this.navigateToPreset(preset);
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      cssClass: 'home-prayer-sheet',
      buttons: [
        ...sections.map((section) => this.toActionSheetButton(preset, section)),
      ],
    });

    await actionSheet.present();
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
        return 'assets/icons/morning.svg';
      default:
        return 'assets/icons/noon.svg';
    }
  }

  private navigateToPreset(
    preset: PrayerPresetSummary,
    sectionId?: string,
  ): void {
    void this.router.navigate(['/reader', preset.id], {
      queryParams: sectionId ? { section: sectionId } : {},
    });
  }

  private toActionSheetButton(
    preset: PrayerPresetSummary,
    section: PrayerSectionDocument,
  ): ActionSheetButton {
    return {
      text: section.title,
      handler: () => {
        this.navigateToPreset(preset, section.id);
      },
    };
  }
}
