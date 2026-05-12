import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import {
  ActionSheetButton,
  ActionSheetController,
  ActionSheetOptions,
} from '@ionic/angular/standalone';

import { HomePage } from './home.page';

describe('HomePage', () => {
  let component: HomePage;
  let fixture: ComponentFixture<HomePage>;
  let router: Router;
  let actionSheetController: jasmine.SpyObj<ActionSheetController>;
  let presentSpy: jasmine.Spy;
  let capturedActionSheetOptions: ActionSheetOptions | undefined;

  beforeEach(async () => {
    presentSpy = jasmine.createSpy('present').and.resolveTo();
    actionSheetController = jasmine.createSpyObj<ActionSheetController>('ActionSheetController', ['create']);
    actionSheetController.create.and.callFake(async (options?: ActionSheetOptions) => {
      capturedActionSheetOptions = options;

      return {
        present: presentSpy,
      } as never;
    });

    await TestBed.configureTestingModule({
      imports: [HomePage],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {},
          },
        },
        { provide: ActionSheetController, useValue: actionSheetController },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigate').and.resolveTo(true);

    fixture = TestBed.createComponent(HomePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('navigates directly for a regular preset', async () => {
    const mincha = component.presets.find((preset) => preset.id === 'mincha');

    expect(mincha).toBeDefined();

    await component.openPreset(mincha!);

    expect(router.navigate).toHaveBeenCalledWith(['/reader', 'mincha'], {
      queryParams: { page: 96 },
    });
    expect(actionSheetController.create).not.toHaveBeenCalled();
  });

  it('opens an action sheet for shacharit', async () => {
    const shacharit = component.presets.find((preset) => preset.id === 'shacharit');

    expect(shacharit).toBeDefined();

    await component.openPreset(shacharit!);

    expect(actionSheetController.create).toHaveBeenCalled();
    expect(capturedActionSheetOptions?.header).toBe('שחרית');
    expect(getObjectButtons(capturedActionSheetOptions).map((button) => button.text)).toEqual([
      'ברכות השחר',
      'קרבנות',
      'הודו',
      'ישתבח',
      'ביטול',
    ]);
    expect(presentSpy).toHaveBeenCalled();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('navigates to the selected shacharit section start page', async () => {
    const shacharit = component.presets.find((preset) => preset.id === 'shacharit');

    expect(shacharit).toBeDefined();

    await component.openPreset(shacharit!);

    const buttons = getObjectButtons(capturedActionSheetOptions);
    const sectionExpectations = [
      { text: 'ברכות השחר', page: 6 },
      { text: 'קרבנות', page: 18 },
      { text: 'הודו', page: 27 },
      { text: 'ישתבח', page: 41 },
    ];

    sectionExpectations.forEach(({ text, page }) => {
      const button = buttons.find((entry) => entry.text === text);

      expect(button).withContext(text).toBeDefined();
      button?.handler?.();

      expect(router.navigate).toHaveBeenCalledWith(['/reader', 'shacharit'], {
        queryParams: { page },
      });
    });
  });

  function getObjectButtons(options?: ActionSheetOptions): ActionSheetButton[] {
    return (options?.buttons ?? []).filter(
      (button): button is ActionSheetButton => typeof button !== 'string',
    );
  }
});
