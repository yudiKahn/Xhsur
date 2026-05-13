import { CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  TranslateLoader,
  TranslateModule,
  TranslateService,
  TranslationObject,
} from '@ngx-translate/core';
import { Observable, firstValueFrom, of } from 'rxjs';

import { AppComponent } from './app.component';

const TEST_TRANSLATIONS = {
  app: {
    title: 'Test Siddur',
    meta: {
      applicationName: 'Siddur',
      appleMobileWebAppTitle: 'Siddur',
    },
  },
};

class TestTranslateLoader implements TranslateLoader {
  getTranslation(_lang: string): Observable<TranslationObject> {
    return of(TEST_TRANSLATIONS);
  }
}

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        AppComponent,
        TranslateModule.forRoot({
          loader: {
            provide: TranslateLoader,
            useClass: TestTranslateLoader,
          },
        }),
      ],
      providers: [provideRouter([])],
      schemas: [CUSTOM_ELEMENTS_SCHEMA],
    }).compileComponents();

    const translateService = TestBed.inject(TranslateService);
    await firstValueFrom(translateService.use('he'));
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });
});
