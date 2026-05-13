import { ApplicationConfig, inject, provideAppInitializer } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import {
  RouteReuseStrategy,
  provideRouter,
  withComponentInputBinding,
  withHashLocation,
  withPreloading,
} from '@angular/router';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { IonicRouteStrategy } from '@ionic/angular';
import { PreloadAllModules } from '@angular/router';
import { provideTranslateService, TranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { firstValueFrom } from 'rxjs';
import { appRoutes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideHttpClient(),
    provideIonicAngular(),
    provideRouter(
      appRoutes,
      withPreloading(PreloadAllModules),
      withComponentInputBinding(),
      withHashLocation(),
    ),
    provideTranslateService({
      loader: provideTranslateHttpLoader({
        prefix: './assets/i18n/',
        suffix: '.json',
      }),
    }),
    provideAppInitializer(() => {
      const translateService = inject(TranslateService);
      translateService.setDefaultLang('he');

      return firstValueFrom(translateService.use('he'));
    }),
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
  ],
};
