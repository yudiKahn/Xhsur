import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ActionSheetButton, ActionSheetController, ActionSheetOptions } from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { PrayerDocument } from '../../models/prayer-content.model';
import { PrayerContentService } from '../../services/prayer-content.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let router: Router;
  let contentService: jasmine.SpyObj<PrayerContentService>;
  let actionSheetController: jasmine.SpyObj<ActionSheetController>;
  let capturedOptions: ActionSheetOptions | undefined;

  beforeEach(async () => {
    contentService = jasmine.createSpyObj<PrayerContentService>('PrayerContentService', ['getPrayerDocument']);
    actionSheetController = jasmine.createSpyObj<ActionSheetController>('ActionSheetController', ['create']);
    actionSheetController.create.and.callFake(async (options?: ActionSheetOptions) => {
      capturedOptions = options;
      return { present: jasmine.createSpy('present').and.resolveTo() } as never;
    });

    await TestBed.configureTestingModule({
      imports: [HomePage, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: PrayerContentService, useValue: contentService },
        { provide: ActionSheetController, useValue: actionSheetController },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);
    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows only prayers backed by Markdown files', () => {
    expect(component.presets.map((preset) => preset.id)).toEqual([
      'shacharit', 'mincha', 'birkat-hamazon', 'tefilat-haderech', 'maariv',
    ]);
  });

  it('opens a Markdown-derived section sheet for a multi-section prayer', async () => {
    contentService.getPrayerDocument.and.resolveTo(documentWithSections(['ברכות השחר', 'הודו']));
    const preset = component.presets[0];

    await component.openPreset(preset);

    const buttons = (capturedOptions?.buttons ?? []) as ActionSheetButton[];
    expect(buttons.map((button) => button.text)).toEqual(['ברכות השחר', 'הודו']);
    buttons[1].handler?.();
    expect(router.navigate).toHaveBeenCalledWith(['/reader', 'shacharit'], {
      queryParams: { section: 'section-1' },
    });
  });

  it('opens a single-section prayer directly', async () => {
    contentService.getPrayerDocument.and.resolveTo(documentWithSections(['תפילת הדרך']));
    const preset = component.presets.find((entry) => entry.id === 'tefilat-haderech')!;

    await component.openPreset(preset);

    expect(actionSheetController.create).not.toHaveBeenCalled();
    expect(router.navigate).toHaveBeenCalledWith(['/reader', 'tefilat-haderech'], { queryParams: {} });
  });

  function documentWithSections(titles: string[]): PrayerDocument {
    return {
      id: 'test',
      title: titles[0],
      sections: titles.map((title, index) => ({
        id: `section-${index}`,
        title,
        blocks: [{ type: 'heading', text: title, level: index ? 2 : 1 }],
      })),
    };
  }
});
