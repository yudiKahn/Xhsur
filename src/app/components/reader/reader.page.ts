import { Location } from '@angular/common';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
  computed,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  ActionSheetButton,
  ActionSheetController,
  IonButton,
  IonContent,
  IonSpinner,
} from '@ionic/angular/standalone';
import { combineLatest } from 'rxjs';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { PrayerBlock } from '../../models/prayer-content.model';
import { ResolvedPrayerSection } from '../../models/prayer-preset.model';
import {
  ReaderPaginationService,
  ReaderRenderedBlock,
  ReaderRenderedSection,
  ReaderTextPage,
  ReaderTextPageEntry,
} from '../../services/reader-pagination.service';
import { PrayerContentService } from '../../services/prayer-content.service';
import { PrayerPresetsService } from '../../services/prayer-presets.service';

const LONG_PRESS_DURATION_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE_PX = 12;
const PAGE_PRELOAD_DISTANCE = 5;

type SwiperInstance = {
  activeIndex: number;
  update: () => void;
  slideTo: (index: number, speed?: number, runCallbacks?: boolean) => void;
};

type SwiperElement = HTMLElement & {
  initialize: () => void;
  swiper?: SwiperInstance;
};

@Component({
  selector: 'app-reader',
  templateUrl: './reader.page.html',
  styleUrls: ['./reader.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonContent,
    IonSpinner,
    TranslatePipe,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ReaderPage implements OnInit, AfterViewInit, OnDestroy {
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly visibleSections = signal<ResolvedPrayerSection[]>([]);
  readonly renderedSections = signal<ReaderRenderedSection[]>([]);
  readonly textPages = signal<ReaderTextPage[]>([]);
  readonly currentPageIndex = signal(0);
  readonly visiblePageWindow = computed(() => {
    const pages = this.textPages();
    const currentPageIndex = this.currentPageIndex();

    if (!pages.length) {
      return {
        startIndex: 0,
        pages: [] as ReaderTextPage[],
      };
    }

    const startIndex = Math.max(0, currentPageIndex - PAGE_PRELOAD_DISTANCE);
    const endIndex = Math.min(pages.length - 1, currentPageIndex + PAGE_PRELOAD_DISTANCE);

    return {
      startIndex,
      pages: pages.slice(startIndex, endIndex + 1),
    };
  });
  readonly visiblePages = computed(() => this.visiblePageWindow().pages);
  readonly activeSlideIndex = computed(() => {
    const window = this.visiblePageWindow();
    return Math.max(0, this.currentPageIndex() - window.startIndex);
  });

  @ViewChild('readerTextBody')
  private readerTextBody?: ElementRef<SwiperElement>;

  @ViewChild('pageMeasureHost')
  private pageMeasureHost?: ElementRef<HTMLElement>;

  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly location = inject(Location);
  private readonly readerPaginationService = inject(ReaderPaginationService);
  private readonly prayerContentService = inject(PrayerContentService);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private pendingSectionId?: string;
  private pendingPageIndex?: number;
  private paginationRebuildFrameId?: number;
  private isRecentering = false;
  private longPressTimer?: ReturnType<typeof setTimeout>;
  private longPressStartPoint?: { x: number; y: number };
  private activePressType?: 'pointer' | 'touch';

  ngAfterViewInit(): void {
    this.initializeSwiper();
    this.schedulePaginationRebuild();
  }

  ngOnDestroy(): void {
    if (this.paginationRebuildFrameId !== undefined) {
      cancelAnimationFrame(this.paginationRebuildFrameId);
      this.paginationRebuildFrameId = undefined;
    }
  }

  ngOnInit(): void {
    combineLatest([
      this.activatedRoute.paramMap,
      this.activatedRoute.queryParamMap,
    ])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(async ([paramMap, queryParamMap]) => {
        await this.loadReaderContent(
          paramMap.get('presetId'),
          queryParamMap.get('section'),
        );
      });
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }

    void this.router.navigateByUrl('/home', { replaceUrl: true });
  }

  canOpenSectionNavigator(): boolean {
    return this.visibleSections().length > 1;
  }

  startLongPress(event: PointerEvent | TouchEvent): void {
    this.cancelLongPress();

    if (!this.canOpenSectionNavigator()) {
      return;
    }

    const point = this.getEventPoint(event);
    if (!point) {
      return;
    }

    this.activePressType = this.isTouchEvent(event) ? 'touch' : 'pointer';
    this.longPressStartPoint = point;
    this.longPressTimer = setTimeout(() => {
      this.cancelLongPress();
      void this.presentSectionNavigator();
    }, LONG_PRESS_DURATION_MS);
  }

  handleLongPressMove(event: PointerEvent | TouchEvent): void {
    if (!this.longPressTimer || !this.longPressStartPoint) {
      return;
    }

    const eventType = this.isTouchEvent(event) ? 'touch' : 'pointer';
    if (this.activePressType && this.activePressType !== eventType) {
      return;
    }

    const point = this.getEventPoint(event);
    if (!point) {
      return;
    }

    const movedX = Math.abs(point.x - this.longPressStartPoint.x);
    const movedY = Math.abs(point.y - this.longPressStartPoint.y);

    if (movedX > LONG_PRESS_MOVE_TOLERANCE_PX || movedY > LONG_PRESS_MOVE_TOLERANCE_PX) {
      this.cancelLongPress();
    }
  }

  cancelLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = undefined;
    }

    this.longPressStartPoint = undefined;
    this.activePressType = undefined;
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.schedulePaginationRebuild();
  }

  trackByPage(index: number, page: ReaderTextPage): string {
    return page.id;
  }

  trackByPageEntry(index: number, entry: ReaderTextPageEntry): string {
    return `${entry.sectionId}:${entry.block.type}:${entry.block.level ?? 0}:${index}`;
  }

  trackBySegment(index: number): number {
    return index;
  }

  async openSection(section: ResolvedPrayerSection): Promise<void> {
    this.cancelLongPress();

    await this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { section: section.id },
      replaceUrl: true,
    });
  }

  private async presentSectionNavigator(): Promise<void> {
    if (!this.canOpenSectionNavigator()) {
      return;
    }

    const actionSheet = await this.actionSheetController.create({
      buttons: this.visibleSections().map((section) => this.toActionSheetButton(section)),
    });

    await actionSheet.present();
  }

  private toActionSheetButton(section: ResolvedPrayerSection): ActionSheetButton {
    return {
      text: this.translateService.instant(section.titleKey),
      handler: () => {
        void this.openSection(section);
      },
    };
  }

  private async loadReaderContent(
    presetId: string | null,
    requestedSectionId: string | null,
  ): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.pendingPageIndex = undefined;

    try {
      if (!presetId) {
        this.loadError.set('Missing preset id.');
        this.visibleSections.set([]);
        this.renderedSections.set([]);
        this.textPages.set([]);
        this.currentPageIndex.set(0);
        return;
      }

      const preset = this.prayerPresetsService.getById(presetId);
      if (!preset) {
        this.loadError.set('Preset is not available.');
        this.visibleSections.set([]);
        this.renderedSections.set([]);
        this.textPages.set([]);
        this.currentPageIndex.set(0);
        return;
      }

      const requestedSection = requestedSectionId
        ? preset.sections.find((section) => section.id === requestedSectionId)
        : undefined;

      if (requestedSectionId && !requestedSection) {
        this.loadError.set('Requested section is not available.');
        this.visibleSections.set([]);
        this.renderedSections.set([]);
        this.textPages.set([]);
        this.currentPageIndex.set(0);
        return;
      }

      const sectionsToLoad = preset.sections;
      this.visibleSections.set(sectionsToLoad);

      const renderedSections = await Promise.all(
        sectionsToLoad.map(async (section) => {
          const blocks = await this.prayerContentService.getSectionBlocks(section);

          return {
            id: section.id,
            titleKey: section.titleKey,
            blocks: this.toRenderedBlocks(blocks),
          };
        }),
      );
      const visibleRenderedSections = renderedSections.filter((section) => section.blocks.length > 0);
      this.renderedSections.set(visibleRenderedSections);
      this.pendingSectionId = requestedSection?.id ?? visibleRenderedSections[0]?.id;
    } catch {
      this.loadError.set('Failed to load siddur text content.');
      this.visibleSections.set([]);
      this.renderedSections.set([]);
      this.textPages.set([]);
      this.currentPageIndex.set(0);
    } finally {
      this.isLoading.set(false);
      if (!this.loadError()) {
        queueMicrotask(() => this.schedulePaginationRebuild());
      }
    }
  }

  private scrollToSection(sectionId: string | undefined): void {
    if (!sectionId) {
      return;
    }

    const pageIndex = this.readerPaginationService.getPageIndexForSection(this.textPages(), sectionId);
    if (pageIndex === undefined) {
      return;
    }

    this.setCurrentPageIndex(pageIndex);
    this.pendingPageIndex = undefined;
    this.syncSwiperToCurrentPage();
  }

  private schedulePaginationRebuild(): void {
    if (this.paginationRebuildFrameId !== undefined) {
      cancelAnimationFrame(this.paginationRebuildFrameId);
    }

    this.paginationRebuildFrameId = requestAnimationFrame(() => {
      this.paginationRebuildFrameId = undefined;
      void this.rebuildTextPages();
    });
  }

  private async rebuildTextPages(): Promise<void> {
    const pager = this.readerTextBody?.nativeElement;
    const measureHost = this.pageMeasureHost?.nativeElement;
    if (!pager || !measureHost) {
      return;
    }

    await this.waitForFontsReady();

    const availableHeight = pager.clientHeight;
    if (!availableHeight) {
      return;
    }

    const finalPages = this.readerPaginationService.paginate(this.renderedSections(), measureHost, availableHeight);
    const initialPageIndex = this.readerPaginationService.resolveInitialPageIndex(
      finalPages,
      this.pendingSectionId,
    );

    this.setCurrentPageIndex(initialPageIndex, finalPages.length);
    this.textPages.set(finalPages);

    requestAnimationFrame(() => {
      this.initializeSwiper();
      this.syncSwiperToCurrentPage();
      this.pendingSectionId = undefined;
    });
  }

  private initializeSwiper(): void {
    const swiperElement = this.readerTextBody?.nativeElement;
    if (!swiperElement || swiperElement.swiper) {
      return;
    }

    Object.assign(swiperElement, {
      init: false,
      initialSlide: 0,
      speed: 250,
      passiveListeners: false,
      touchStartPreventDefault: false,
    });

    swiperElement.initialize();
  }

  private setCurrentPageIndex(nextIndex: number, pageCount = this.textPages().length): void {
    if (pageCount <= 0) {
      this.currentPageIndex.set(0);
      return;
    }

    const clampedIndex = Math.min(Math.max(0, nextIndex), pageCount - 1);
    this.currentPageIndex.set(clampedIndex);
  }

  private syncSwiperToCurrentPage(): void {
    const swiper = this.getSwiper();
    if (!swiper) {
      return;
    }

    this.isRecentering = true;
    requestAnimationFrame(() => {
      swiper.update();
      swiper.slideTo(this.activeSlideIndex(), 0, false);
      requestAnimationFrame(() => {
        this.isRecentering = false;
      });
    });
  }

  private getSwiper(): SwiperInstance | undefined {
    return this.readerTextBody?.nativeElement.swiper;
  }

  private async waitForFontsReady(): Promise<void> {
    const fontFaces = document.fonts;
    if (!fontFaces || fontFaces.status === 'loaded') {
      return;
    }

    await fontFaces.ready;
  }

  onSwiperSlideChange(): void {
    const swiper = this.getSwiper();
    if (!swiper || this.isRecentering) {
      return;
    }

    if (!this.visiblePages()[swiper.activeIndex]) {
      return;
    }

    const nextPageIndex = this.visiblePageWindow().startIndex + swiper.activeIndex;
    if (nextPageIndex === this.currentPageIndex()) {
      return;
    }

    this.pendingPageIndex = nextPageIndex;
  }

  onSwiperSlideTransitionEnd(): void {
    if (this.isRecentering) {
      return;
    }

    if (this.pendingPageIndex !== undefined) {
      this.setCurrentPageIndex(this.pendingPageIndex);
      this.pendingPageIndex = undefined;
      this.syncSwiperToCurrentPage();
    }

    this.cancelLongPress();
  }

  private getEventPoint(
    event: PointerEvent | TouchEvent,
  ): { x: number; y: number } | undefined {
    if (this.isTouchEvent(event)) {
      const touch = event.touches[0] ?? event.changedTouches[0];
      if (!touch) {
        return undefined;
      }

      return {
        x: touch.clientX,
        y: touch.clientY,
      };
    }

    return {
      x: event.clientX,
      y: event.clientY,
    };
  }

  private isTouchEvent(event: PointerEvent | TouchEvent): event is TouchEvent {
    return 'touches' in event;
  }

  private toRenderedBlocks(blocks: PrayerBlock[]): ReaderRenderedBlock[] {
    return blocks.reduce<ReaderRenderedBlock[]>((result, block) => {
      const previousBlock = result[result.length - 1];
      const shouldMergeIntoPreviousParagraph =
        block.type === 'paragraph' &&
        !!block.marker &&
        previousBlock?.type === 'paragraph';

      if (shouldMergeIntoPreviousParagraph) {
        previousBlock.segments.push({
          marker: block.marker,
          text: block.text,
        });
        return result;
      }

      result.push({
        type: block.type,
        level: block.level,
        segments: [
          {
            marker: block.marker,
            text: block.text,
          },
        ],
      });

      return result;
    }, []);
  }
}
