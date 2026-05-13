import { Component, OnInit, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
import { PrayerPreset, PrayerSubPreset } from '../models/prayer-preset.model';
import { PrayerPresetsService } from '../services/prayer-presets.service';

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
  presets: PrayerPreset[] = [];
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);

  ngOnInit(): void {
    this.presets = this.prayerPresetsService.getAll();
  }

  async openPreset(preset: PrayerPreset, page?: number): Promise<void> {
    if (!page && preset.subPresets?.length) {
      await this.presentSubPresets(preset);
      return;
    }

    this.navigateToPreset(preset, page);
  }

  trackByPreset(index: number, preset: PrayerPreset): string {
    return preset.id;
  }

  private navigateToPreset(preset: PrayerPreset, page?: number): void {
    const targetPage = page ?? preset.startPage;
    void this.router.navigate(['/reader', preset.id], {
      queryParams: { page: targetPage },
    });
  }

  private async presentSubPresets(preset: PrayerPreset): Promise<void> {
    const subPresets = preset.subPresets;
    if (!subPresets?.length) {
      this.navigateToPreset(preset);
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      header: this.translateService.instant(preset.titleKey),
      buttons: [
        ...subPresets.map((subPreset) => this.toActionSheetButton(preset, subPreset)),
        {
          text: this.translateService.instant('common.actions.cancel'),
          role: 'cancel',
        },
      ],
    });

    await actionSheet.present();
  }

  private toActionSheetButton(
    preset: PrayerPreset,
    subPreset: PrayerSubPreset,
  ): ActionSheetButton {
    return {
      text: this.translateService.instant(subPreset.titleKey),
      handler: () => {
        this.navigateToPreset(preset, subPreset.startPage);
      },
    };
  }
}
