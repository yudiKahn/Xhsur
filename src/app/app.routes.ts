import { Routes } from '@angular/router';

export const appRoutes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./components/home/home.page').then((component) => component.HomePage),
  },
  {
    path: 'reader/:presetId',
    loadComponent: () =>
      import('./components/reader/reader.page').then((component) => component.ReaderPage),
  },
  {
    path: 'hayom-yom',
    loadComponent: () =>
      import('./components/hayom-yom/hayom-yom.page').then((component) => component.HayomYomPage),
  },
  {
    path: 'shiurim',
    loadComponent: () =>
      import('./components/shiurim/shiurim.page').then((component) => component.ShiurimPage),
  },
  {
    path: 'about',
    loadComponent: () =>
      import('./components/about/about.page').then((component) => component.AboutPage),
  },
  {
    path: 'settings',
    loadComponent: () =>
      import('./components/settings/settings.page').then((component) => component.SettingsPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
