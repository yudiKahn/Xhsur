import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
  selector: 'app-shiurim',
  templateUrl: './shiurim.page.html',
  styleUrls: ['./shiurim.page.scss'],
  standalone: true,
  imports: [
    IonBackButton,
    IonButtons,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
})
export class ShiurimPage {
  private readonly router = inject(Router);

  openHayomYom(): void {
    void this.router.navigateByUrl('/hayom-yom');
  }
}
