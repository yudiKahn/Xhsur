import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  HostListener,
  OnDestroy,
  OnInit,
  ViewChild,
  inject,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonContent,
  IonSpinner,
} from '@ionic/angular/standalone';
import { PrayerPreset } from '../models/prayer-preset.model';
import { PrayerPresetsService } from '../services/prayer-presets.service';

const PDF_ASSET_PATH = '/assets/siddur/tehilat-hashem.pdf';
const PDF_WORKER_PATH = '/assets/pdfjs/pdf.worker.min.mjs';
const PAGE_PRELOAD_DISTANCE = 5;
const MAX_RENDER_PIXEL_RATIO = 2;
const MAX_ZOOM_RATIO = 3;

type SwiperZoom = {
  scale?: number;
  in: (value?: number | Event) => void;
  out: () => void;
  toggle: (event?: Event) => void;
};

type SwiperElement = HTMLElement & {
  initialize: () => void;
  swiper?: {
    activeIndex: number;
    allowTouchMove: boolean;
    zoom: SwiperZoom;
    update: () => void;
    slideTo: (index: number, speed?: number, runCallbacks?: boolean) => void;
  };
};

type PdfJsModule = {
  GlobalWorkerOptions: {
    workerSrc: string;
  };
  getDocument: (src: { data: Uint8Array; disableWorker: boolean }) => {
    promise: Promise<PdfDocumentProxy>;
    destroy?: () => Promise<void> | void;
  };
};

type PdfDocumentProxy = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageProxy>;
  destroy: () => Promise<void> | void;
};

type PdfPageProxy = {
  getViewport: (params: { scale: number }) => { width: number; height: number };
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: { width: number; height: number };
  }) => {
    promise: Promise<void>;
    cancel?: () => void;
  };
  cleanup?: () => void;
};

type RenderedPage = {
  pageNumber: number;
  src: string;
  width: number;
  height: number;
};

@Component({
  selector: 'app-reader',
  templateUrl: './reader.page.html',
  styleUrls: ['./reader.page.scss'],
  standalone: true,
  imports: [
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonSpinner,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ReaderPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('swiperRef')
  private readonly swiperRef?: ElementRef<SwiperElement>;

  @ViewChild('stageRef')
  private readonly stageRef?: ElementRef<HTMLElement>;

  preset?: PrayerPreset;
  currentPage = 1;
  visiblePages: number[] = [];
  activeSlideIndex = 0;
  isPdfAvailable = false;
  isPdfLoading = true;
  isZoomed = false;
  loadErrorMessage = '';
  readonly maxZoomRatio = MAX_ZOOM_RATIO;

  private pdfDocument?: PdfDocumentProxy;
  private pdfLoadingTask?: {
    promise: Promise<PdfDocumentProxy>;
    destroy?: () => Promise<void> | void;
  };
  private pdfJsModulePromise?: Promise<PdfJsModule>;
  private readonly renderCache = new Map<number, RenderedPage>();
  private readonly pendingRenders = new Set<number>();
  private renderRevision = 0;
  private isRecentering = false;
  private prewarmTimeoutId?: number;
  private pendingPage?: number;

  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly changeDetectorRef = inject(ChangeDetectorRef);

  async ngOnInit(): Promise<void> {
    const presetId = this.activatedRoute.snapshot.paramMap.get('presetId');
    const preset = presetId ? this.prayerPresetsService.getById(presetId) : undefined;

    if (!preset) {
      void this.router.navigateByUrl('/home', { replaceUrl: true });
      return;
    }

    this.preset = preset;
    this.currentPage = this.resolveInitialPage(preset);
    this.syncVisiblePages();

    await this.loadPdfDocument();
  }

  ngAfterViewInit(): void {
    this.initializeSwiper();
    this.recenterSwiper();
    void this.prepareVisiblePages();
  }

  ngOnDestroy(): void {
    this.renderRevision += 1;
    this.clearPrewarmTimeout();
    this.clearRenderedPages();
    void this.destroyPdfSession();
  }

  onSwiperSlideChange(): void {
    const swiper = this.getSwiper();
    if (!swiper || this.isRecentering || !this.preset) {
      return;
    }

    const nextIndex = swiper.activeIndex;
    if (nextIndex === this.activeSlideIndex) {
      return;
    }

    const nextPage = this.visiblePages[nextIndex];
    if (!nextPage) {
      this.recenterSwiper();
      return;
    }

    if (nextPage < this.preset.startPage || nextPage > this.preset.endPage) {
      this.recenterSwiper();
      return;
    }

    this.pendingPage = nextPage;
  }

  onSwiperSlideChangeTransitionEnd(): void {
    if (this.pendingPage === undefined) {
      return;
    }

    this.currentPage = this.pendingPage;
    this.pendingPage = undefined;
    this.resetZoom();
    this.syncVisiblePages();
    this.updateLoadingState();
    this.recenterSwiper();
    void this.prepareVisiblePages();
  }

  onZoomChange(event: Event): void {
    if (!(event instanceof CustomEvent)) {
      return;
    }

    const [scale] = event.detail as [number?, unknown?, unknown?];
    this.syncZoomState(scale ?? 1);
  }

  onStageDoubleClick(event: MouseEvent): void {
    event.preventDefault();
    const swiper = this.getSwiper();
    if (!swiper) {
      return;
    }

    if ((swiper.zoom.scale ?? 1) > 1.01) {
      this.resetZoom();
      return;
    }

    swiper.zoom.in(Math.min(2, this.maxZoomRatio));
    this.syncZoomState(Math.min(2, this.maxZoomRatio));
  }

  onStageWheel(event: WheelEvent): void {
    if (!event.ctrlKey) {
      return;
    }

    event.preventDefault();
    const swiper = this.getSwiper();
    if (!swiper) {
      return;
    }

    const currentScale = swiper.zoom.scale ?? 1;
    const nextScale = event.deltaY < 0 ? currentScale + 0.25 : currentScale - 0.25;
    const clampedScale = Math.min(this.maxZoomRatio, Math.max(1, nextScale));

    if (clampedScale <= 1.01) {
      this.resetZoom();
      return;
    }

    swiper.zoom.in(clampedScale);
    this.syncZoomState(clampedScale);
  }

  trackByPage(_index: number, pageNumber: number): number {
    return pageNumber;
  }

  getRenderedPage(pageNumber: number): RenderedPage | undefined {
    return this.renderCache.get(pageNumber);
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.pdfDocument) {
      return;
    }

    this.resetZoom();
    this.renderRevision += 1;
    this.clearPrewarmTimeout();
    this.clearRenderedPages();
    this.updateLoadingState();

    window.setTimeout(() => {
      void this.prepareVisiblePages();
    }, 50);
  }

  private async loadPdfDocument(): Promise<void> {
    this.isPdfLoading = true;
    this.loadErrorMessage = '';

    try {
      const response = await fetch(PDF_ASSET_PATH);
      if (!response.ok) {
        throw new Error(`Failed to load PDF (${response.status}).`);
      }

      const pdfData = new Uint8Array(await response.arrayBuffer());
      const pdfJs = await this.getPdfJsModule();
      pdfJs.GlobalWorkerOptions.workerSrc = PDF_WORKER_PATH;
      this.pdfLoadingTask = pdfJs.getDocument({
        data: pdfData,
        disableWorker: false,
      });
      this.pdfDocument = await this.pdfLoadingTask.promise;
      this.isPdfAvailable = true;
      this.loadErrorMessage = '';
      this.refreshView();
      window.setTimeout(() => {
        this.initializeSwiper();
        this.recenterSwiper();
        void this.prepareVisiblePages();
      });
      await this.prepareVisiblePages();
    } catch (error) {
      this.isPdfAvailable = false;
      this.isPdfLoading = false;
      this.loadErrorMessage =
        error instanceof Error ? error.message : 'Failed to load PDF.';
      this.refreshView();
    }
  }

  private async getPdfJsModule(): Promise<PdfJsModule> {
    this.pdfJsModulePromise ??= import(
      '../../../node_modules/pdfjs-dist/legacy/build/pdf.mjs'
    ) as unknown as Promise<PdfJsModule>;

    return this.pdfJsModulePromise;
  }

  private resolveInitialPage(preset: PrayerPreset): number {
    const queryPage = Number.parseInt(this.activatedRoute.snapshot.queryParamMap.get('page') ?? '', 10);

    if (Number.isNaN(queryPage)) {
      return preset.startPage;
    }

    return Math.min(preset.endPage, Math.max(preset.startPage, queryPage));
  }

  private syncVisiblePages(): void {
    if (!this.preset) {
      this.visiblePages = [];
      this.activeSlideIndex = 0;
      return;
    }

    const pages: number[] = [];
    const startPage = Math.max(this.preset.startPage, this.currentPage - PAGE_PRELOAD_DISTANCE);
    const endPage = Math.min(this.preset.endPage, this.currentPage + PAGE_PRELOAD_DISTANCE);

    for (let pageNumber = startPage; pageNumber <= endPage; pageNumber += 1) {
      pages.push(pageNumber);
    }

    this.visiblePages = pages;
    this.activeSlideIndex = pages.indexOf(this.currentPage);
  }

  private async prepareVisiblePages(): Promise<void> {
    if (!this.pdfDocument || !this.preset) {
      return;
    }

    const revision = this.renderRevision;
    const pagesToPrepare = this.getPagesToPrepare();
    this.evictStalePages();

    await Promise.all(pagesToPrepare.map((pageNumber) => this.ensurePageRendered(pageNumber, revision)));

    if (revision !== this.renderRevision) {
      return;
    }

    this.updateLoadingState();
    this.schedulePrewarm(revision);
  }

  private getPagesToPrepare(): number[] {
    if (!this.preset) {
      return [];
    }

    const pages = new Set<number>(this.visiblePages);
    const beforeCurrent = this.currentPage - PAGE_PRELOAD_DISTANCE;
    const afterCurrent = this.currentPage + PAGE_PRELOAD_DISTANCE;

    if (beforeCurrent >= this.preset.startPage) {
      pages.add(beforeCurrent);
    }

    if (afterCurrent <= this.preset.endPage) {
      pages.add(afterCurrent);
    }

    return Array.from(pages).sort((left, right) => left - right);
  }

  private evictStalePages(): void {
    if (!this.preset) {
      this.renderCache.clear();
      return;
    }

    const minPage = Math.max(this.preset.startPage, this.currentPage - PAGE_PRELOAD_DISTANCE);
    const maxPage = Math.min(this.preset.endPage, this.currentPage + PAGE_PRELOAD_DISTANCE);

    Array.from(this.renderCache.keys()).forEach((pageNumber) => {
      if (pageNumber < minPage || pageNumber > maxPage) {
        this.renderCache.delete(pageNumber);
      }
    });
  }

  private schedulePrewarm(revision: number): void {
    if (!this.preset) {
      return;
    }

    this.clearPrewarmTimeout();

    this.prewarmTimeoutId = window.setTimeout(() => {
      if (revision !== this.renderRevision || !this.preset) {
        return;
      }

      const extraPages = [
        this.currentPage - PAGE_PRELOAD_DISTANCE - 1,
        this.currentPage + PAGE_PRELOAD_DISTANCE + 1,
      ].filter(
        (pageNumber) =>
          pageNumber >= this.preset!.startPage && pageNumber <= this.preset!.endPage,
      );

      extraPages.forEach((pageNumber) => {
        void this.ensurePageRendered(pageNumber, revision);
      });
    }, 120);
  }

  private async ensurePageRendered(pageNumber: number, revision: number): Promise<void> {
    if (!this.pdfDocument || this.renderCache.has(pageNumber) || this.pendingRenders.has(pageNumber)) {
      return;
    }

    const stageSize = this.getStageSize();
    if (!stageSize) {
      return;
    }

    this.pendingRenders.add(pageNumber);

    try {
      const page = await this.pdfDocument.getPage(pageNumber);
      const baseViewport = page.getViewport({ scale: 1 });
      const fitScale = stageSize.width / baseViewport.width;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, MAX_RENDER_PIXEL_RATIO);
      const renderViewport = page.getViewport({ scale: fitScale * pixelRatio });
      const displayWidth = Math.round(stageSize.width);
      const displayHeight = Math.round(baseViewport.height * fitScale);

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.floor(renderViewport.width));
      canvas.height = Math.max(1, Math.floor(renderViewport.height));

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Canvas rendering is not available.');
      }

      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);

      const renderTask = page.render({
        canvasContext: context,
        viewport: renderViewport,
      });

      await renderTask.promise;

      if (revision !== this.renderRevision) {
        page.cleanup?.();
        return;
      }

      this.renderCache.set(pageNumber, {
        pageNumber,
        src: canvas.toDataURL('image/png'),
        width: displayWidth,
        height: displayHeight,
      });

      if (pageNumber === this.currentPage) {
        this.isPdfLoading = false;
        this.loadErrorMessage = '';
      }

      this.refreshView();

      page.cleanup?.();
    } catch (error) {
      if (pageNumber === this.currentPage) {
        this.loadErrorMessage =
          error instanceof Error ? error.message : 'Failed to render page.';
        this.isPdfLoading = false;
        this.refreshView();
      }
    } finally {
      this.pendingRenders.delete(pageNumber);
    }
  }

  private getStageSize(): { width: number; height: number } | undefined {
    const stageElement = this.stageRef?.nativeElement;
    if (!stageElement) {
      return undefined;
    }

    const width = stageElement.clientWidth;
    const height = stageElement.clientHeight;
    return {
      width: width || window.innerWidth,
      height: height || window.innerHeight,
    };
  }

  private updateLoadingState(): void {
    this.isPdfLoading = !this.renderCache.has(this.currentPage);
    this.refreshView();
  }

  private recenterSwiper(): void {
    const swiper = this.getSwiper();
    if (!swiper) {
      return;
    }

    this.isRecentering = true;
    requestAnimationFrame(() => {
      swiper.update();
      swiper.slideTo(this.activeSlideIndex, 0, false);
      requestAnimationFrame(() => {
        this.isRecentering = false;
      });
    });
  }

  private getSwiper(): SwiperElement['swiper'] {
    return this.swiperRef?.nativeElement.swiper;
  }

  private initializeSwiper(): void {
    const swiperElement = this.swiperRef?.nativeElement;
    if (!swiperElement || swiperElement.swiper) {
      return;
    }

    Object.assign(swiperElement, {
      init: false,
      initialSlide: this.activeSlideIndex,
      speed: 250,
      passiveListeners: false,
      touchStartPreventDefault: false,
      zoom: {
        enabled: true,
        minRatio: 1,
        maxRatio: this.maxZoomRatio,
        toggle: true,
      },
    });

    swiperElement.initialize();
  }

  private resetZoom(): void {
    const swiper = this.getSwiper();
    swiper?.zoom.out();
    this.syncZoomState(1);
  }

  private syncZoomState(scale: number): void {
    this.isZoomed = scale > 1.01;
    const swiper = this.getSwiper();
    if (swiper) {
      swiper.allowTouchMove = !this.isZoomed;
    }
    this.refreshView();
  }

  private clearRenderedPages(): void {
    this.pendingRenders.clear();
    this.renderCache.clear();
  }

  private clearPrewarmTimeout(): void {
    if (this.prewarmTimeoutId === undefined) {
      return;
    }

    window.clearTimeout(this.prewarmTimeoutId);
    this.prewarmTimeoutId = undefined;
  }

  private async destroyPdfSession(): Promise<void> {
    await this.pdfDocument?.destroy();
    await this.pdfLoadingTask?.destroy?.();
  }

  private refreshView(): void {
    this.changeDetectorRef.detectChanges();
  }
}
