import { Component, inject, signal } from '@angular/core';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { HayomYomService } from '../../services/hayom-yom.service';

@Component({
  selector: 'app-hayom-yom',
  templateUrl: './hayom-yom.page.html',
  styleUrls: ['./hayom-yom.page.scss'],
  standalone: true,
  imports: [IonBackButton, IonButtons, IonContent, IonHeader, IonTitle, IonToolbar, TranslatePipe],
})
export class HayomYomPage {
  private readonly hayomYom = inject(HayomYomService);
  readonly entry = signal(this.hayomYom.getTodayEntry());

  get paragraphs(): string[] {
    return this.entry()?.text.split('\n\n') ?? [];
  }
}
