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
import { PrayerContentService } from '../../services/prayer-content.service';
import { PrayerPresetsService } from '../../services/prayer-presets.service';

const LONG_PRESS_DURATION_MS = 450;
const LONG_PRESS_MOVE_TOLERANCE_PX = 12;
const PAGE_PRELOAD_DISTANCE = 5;
const MIN_REMAINING_PAGE_SPACE_RATIO = 0;

interface ReaderRenderedSection {
  id: string;
  titleKey: string;
  blocks: ReaderRenderedBlock[];
}

interface ReaderTextPage {
  id: string;
  sectionIds: string[];
  entries: ReaderTextPageEntry[];
}

interface ReaderTextPageEntry {
  sectionId: string;
  block: ReaderRenderedBlock;
}

interface ReaderRenderedBlock {
  type: PrayerBlock['type'];
  level?: PrayerBlock['level'];
  segments: ReaderRenderedBlockSegment[];
}

interface ReaderRenderedBlockSegment {
  marker?: string;
  text: string;
}

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
  private readonly prayerContentService = inject(PrayerContentService);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private pendingSectionId?: string;
  private pendingPageIndex?: number;
  private paginationRebuildFrameId?: number;
  private isRecentering = false;
  private pageIdCounter = 0;
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

  trackByRenderedSection(index: number, section: ReaderRenderedSection): string {
    return section.id;
  }

  trackByPage(index: number, page: ReaderTextPage): string {
    return page.id;
  }

  trackByPageEntry(index: number, entry: ReaderTextPageEntry): string {
    return `${entry.sectionId}:${entry.block.type}:${entry.block.level ?? 0}:${index}`;
  }

  trackByBlock(index: number): number {
    return index;
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

    const pageIndex = this.getPageIndexForSection(sectionId);
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

    this.pageIdCounter = 0;
    const availableHeight = pager.clientHeight;
    if (!availableHeight) {
      return;
    }

    const pages = this.buildTextPages(measureHost, availableHeight);
    const finalPages = pages.length > 0 ? pages : this.buildSectionFallbackPages();
    const initialPageIndex = this.resolveInitialPageIndex(finalPages);

    this.setCurrentPageIndex(initialPageIndex, finalPages.length);
    this.textPages.set(finalPages);

    requestAnimationFrame(() => {
      this.initializeSwiper();
      this.syncSwiperToCurrentPage();
      this.pendingSectionId = undefined;
    });
  }

  private buildSectionFallbackPages(): ReaderTextPage[] {
    return this.renderedSections().map((section) => ({
      id: section.id,
      sectionIds: [section.id],
      entries: section.blocks.map((block) => ({
        sectionId: section.id,
        block,
      })),
    }));
  }

  private buildTextPages(measureHost: HTMLElement, availableHeight: number): ReaderTextPage[] {
    measureHost.replaceChildren();

    const pages: ReaderTextPage[] = [];
    let currentEntries: ReaderTextPageEntry[] = [];

    const measurePage = this.createMeasurePage();
    const measureContent = this.createMeasureContent();
    measurePage.appendChild(measureContent);
    measureHost.appendChild(measurePage);

    for (const section of this.renderedSections()) {
      for (const block of section.blocks) {
        const entry: ReaderTextPageEntry = {
          sectionId: section.id,
          block,
        };

        const heightBeforeAppend = measureContent.getBoundingClientRect().height;
        const blockElement = this.createBlockElement(block);
        measureContent.appendChild(blockElement);

        const heightAfterAppend = measureContent.getBoundingClientRect().height;
        const remainingSpaceBeforeAppend = availableHeight - heightBeforeAppend;
        const shouldBreakBeforeBlock =
          heightAfterAppend > availableHeight &&
          currentEntries.length > 0 &&
          remainingSpaceBeforeAppend < availableHeight * MIN_REMAINING_PAGE_SPACE_RATIO;

        if (shouldBreakBeforeBlock) {
          measureContent.removeChild(blockElement);
          pages.push(this.finalizeTextPage(currentEntries));

          currentEntries = [entry];
          measureContent.replaceChildren(blockElement);
          continue;
        }

        currentEntries.push(entry);
      }
    }

    if (currentEntries.length > 0) {
      pages.push(this.finalizeTextPage(currentEntries));
    }

    return pages;
  }

  private finalizeTextPage(entries: ReaderTextPageEntry[]): ReaderTextPage {
    const sectionIds = entries.reduce<string[]>((result, entry) => {
      if (!result.includes(entry.sectionId)) {
        result.push(entry.sectionId);
      }

      return result;
    }, []);

    return {
      id: `page-${this.pageIdCounter++}`,
      sectionIds,
      entries: [...entries],
    };
  }

  private createMeasurePage(): HTMLElement {
    const page = document.createElement('section');
    page.className = 'reader-page reader-page--measure';
    return page;
  }

  private createMeasureContent(): HTMLElement {
    const content = document.createElement('article');
    content.className = 'reader-page-content reader-page-content--measure siddur-text-body';
    content.dir = 'rtl';
    return content;
  }

  private createBlockElement(block: ReaderRenderedBlock): HTMLElement {
    const element = document.createElement(this.getBlockTagName(block)) as HTMLElement;

    for (const segment of block.segments) {
      if (segment.marker) {
        const marker = document.createElement('span');
        marker.className = 'siddur-inline-marker';
        marker.textContent = segment.marker;
        element.appendChild(marker);
      }

      element.appendChild(document.createTextNode(segment.text));
    }

    return element;
  }

  private getBlockTagName(block: ReaderRenderedBlock): string {
    switch (block.type) {
      case 'heading':
        switch (block.level) {
          case 2:
            return 'h2';
          case 3:
            return 'h3';
          case 4:
            return 'h4';
          case 5:
            return 'h5';
          default:
            return 'h6';
        }
      case 'comment':
        return 'h6';
      default:
        return 'h1';
    }
  }

  private getPageIndexForSection(sectionId: string): number | undefined {
    const pageIndex = this.textPages().findIndex((page) => page.sectionIds.includes(sectionId));
    return pageIndex >= 0 ? pageIndex : undefined;
  }

  private resolveInitialPageIndex(pages: ReaderTextPage[]): number {
    if (!pages.length) {
      return 0;
    }

    if (!this.pendingSectionId) {
      return 0;
    }

    const sectionId = this.pendingSectionId;
    const requestedPageIndex = pages.findIndex((page) => page.sectionIds.includes(sectionId));
    return requestedPageIndex >= 0 ? requestedPageIndex : 0;
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
