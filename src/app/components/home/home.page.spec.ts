import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { PrayerDocument } from '../../models/prayer-content.model';
import { PrayerContentService } from '../../services/prayer-content.service';
import { JewishCalendarService } from '../../services/jewish-calendar.service';
import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let router: Router;
  let contentService: jasmine.SpyObj<PrayerContentService>;
  let calendarService: jasmine.SpyObj<JewishCalendarService>;

  beforeEach(async () => {
    contentService = jasmine.createSpyObj<PrayerContentService>('PrayerContentService', ['getPrayerDocument']);
    calendarService = jasmine.createSpyObj<JewishCalendarService>(
      'JewishCalendarService',
      ['getCurrentDayLabel'],
    );
    calendarService.getCurrentDayLabel.and.returnValue('יום חמישי י׳ אב');

    await TestBed.configureTestingModule({
      imports: [HomePage, TranslateModule.forRoot()],
      providers: [
        provideRouter([]),
        { provide: PrayerContentService, useValue: contentService },
        { provide: JewishCalendarService, useValue: calendarService },
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

  it('shows the current Jewish day in the header', () => {
    const header = fixture.nativeElement.querySelector('.home-toolbar__day');

    expect(header.textContent.trim()).toBe('יום חמישי י׳ אב');
  });

  it('opens the first section and requests the reader section menu for a multi-section prayer', async () => {
    contentService.getPrayerDocument.and.resolveTo(documentWithSections(['ברכות השחר', 'הודו']));
    const preset = component.presets[0];

    await component.openPreset(preset);

    expect(router.navigate).toHaveBeenCalledWith(['/reader', 'shacharit'], {
      queryParams: { section: 'section-0', openSectionMenu: true },
    });
  });

  it('opens a single-section prayer directly', async () => {
    contentService.getPrayerDocument.and.resolveTo(documentWithSections(['תפילת הדרך']));
    const preset = component.presets.find((entry) => entry.id === 'tefilat-haderech')!;

    await component.openPreset(preset);

    expect(router.navigate).toHaveBeenCalledWith(['/reader', 'tefilat-haderech'], {
      queryParams: { section: 'section-0' },
    });
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
