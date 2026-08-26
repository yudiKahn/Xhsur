import { Component, computed, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { chevronBackOutline, chevronForwardOutline } from 'ionicons/icons';
import { HayomYomService } from '../../services/hayom-yom.service';

@Component({
  selector: 'app-hayom-yom',
  templateUrl: './hayom-yom.page.html',
  styleUrls: ['./hayom-yom.page.scss'],
  standalone: true,
  imports: [IonBackButton, IonButtons, IonButton, IonContent, IonHeader, IonIcon, IonTitle, IonToolbar, TranslatePipe],
})
export class HayomYomPage {
  private readonly hayomYom = inject(HayomYomService);
  readonly currentKey = signal(this.hayomYom.getTodayKey());
  readonly entry = computed(() => this.hayomYom.getEntry(this.currentKey()));
  readonly currentWeekday = computed(() => this.hayomYom.getWeekdayForKey(this.currentKey()));
  readonly canGoPrevious = computed(() => !!this.hayomYom.getAdjacentKey(this.currentKey(), -1));
  readonly canGoNext = computed(() => !!this.hayomYom.getAdjacentKey(this.currentKey(), 1));

  constructor() {
    addIcons({
      'chevron-back-outline': chevronBackOutline,
      'chevron-forward-outline': chevronForwardOutline,
    });
  }

  get paragraphs(): string[] {
    return this.entry()?.text.split('\n\n') ?? [];
  }

  goPrevious(): void {
    const key = this.hayomYom.getAdjacentKey(this.currentKey(), -1);
    if (key) this.currentKey.set(key);
  }

  goNext(): void {
    const key = this.hayomYom.getAdjacentKey(this.currentKey(), 1);
    if (key) this.currentKey.set(key);
  }
}
