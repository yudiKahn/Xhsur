import { Location } from '@angular/common';
import {
  CUSTOM_ELEMENTS_SCHEMA,
  AfterViewInit,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  OnInit,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { RefresherCustomEvent } from '@ionic/angular';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonRefresher,
  IonRefresherContent,
  IonPopover,
  IonSpinner,
  IonToolbar,
  IonIcon
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { combineLatest } from 'rxjs';
import { PrayerBlock, PrayerSectionDocument } from '../../models/prayer-content.model';
import { PrayerContentService } from '../../services/prayer-content.service';
import { PrayerPresetsService } from '../../services/prayer-presets.service';
import { addIcons } from 'ionicons';
import { chevronBackOutline } from 'ionicons/icons';

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
    IonIcon,
    IonHeader,
    IonPopover,
    IonRefresher,
    IonRefresherContent,
    IonSpinner,
    IonToolbar,
    TranslatePipe,
  ],
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ReaderPage implements OnInit, AfterViewInit {
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly readerFontScale = signal(1);
  readonly prayerTitle = signal('');
  readonly sections = signal<PrayerSectionDocument[]>([]);
  readonly activeSectionIndex = signal(0);
  readonly activeSection = computed(() => this.sections()[this.activeSectionIndex()]);
  readonly hasSectionNavigation = computed(() => this.sections().length > 1);

  @ViewChild('readerSwiper')
  private readerSwiper?: ElementRef<SwiperElement>;

  @ViewChild('sectionPopover')
  private sectionPopover?: IonPopover;

  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly contentService = inject(PrayerContentService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly location = inject(Location);
  private readonly presetsService = inject(PrayerPresetsService);
  private readonly router = inject(Router);

  private readonly minimumFontScale = 0.8;
  private readonly maximumFontScale = 1.6;
  private pinchStartDistance: number | null = null;
  private pinchStartFontScale = 1;

  constructor() {
    addIcons({
      'chevron-back-outline': chevronBackOutline,
    });
  }

  ngOnInit(): void {
    combineLatest([this.activatedRoute.paramMap, this.activatedRoute.queryParamMap])
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(([paramMap, queryParamMap]) => {
        void this.loadReaderContent(paramMap.get('presetId'), queryParamMap.get('section'));
      });
  }

  ngAfterViewInit(): void {
    this.initializeSwiper();
  }

  goBack(): void {
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl('/home', { replaceUrl: true });
  }

  onSwiperSlideChange(): void {
    const swiper = this.readerSwiper?.nativeElement.swiper;
    if (!swiper) return;

    this.activeSectionIndex.set(swiper.activeIndex);
    requestAnimationFrame(() => this.scrollSectionToTop(swiper.activeIndex));
  }

  onPinchStart(event: TouchEvent): void {
    if (event.touches.length !== 2) return;

    event.stopPropagation();
    this.pinchStartDistance = this.getTouchDistance(event.touches);
    this.pinchStartFontScale = this.readerFontScale();
  }

  onPinchMove(event: TouchEvent): void {
    if (event.touches.length !== 2 || this.pinchStartDistance === null) return;

    event.preventDefault();
    event.stopPropagation();

    const scaleChange = this.getTouchDistance(event.touches) / this.pinchStartDistance;
    const nextScale = this.pinchStartFontScale * scaleChange;
    this.readerFontScale.set(
      Math.min(this.maximumFontScale, Math.max(this.minimumFontScale, nextScale)),
    );
  }

  onPinchEnd(event: TouchEvent): void {
    if (event.touches.length < 2) {
      this.pinchStartDistance = null;
    }
  }

  async refreshReader(event: RefresherCustomEvent): Promise<void> {
    const presetId = this.activatedRoute.snapshot.paramMap.get('presetId');
    const sectionId = this.activeSection()?.id
      ?? this.activatedRoute.snapshot.queryParamMap.get('section');

    try {
      this.contentService.clearDocumentCache();
      await this.clearAppCaches();
      await this.loadReaderContent(presetId, sectionId);
    } finally {
      await event.target.complete();
    }
  }

  selectSection(index: number): void {
    this.activeSectionIndex.set(index);
    this.readerSwiper?.nativeElement.swiper?.slideTo(index);
    void this.sectionPopover?.dismiss();
  }

  trackBySection(index: number, section: PrayerSectionDocument): string {
    return section.id;
  }

  trackByBlock(index: number, block: PrayerBlock): string {
    return `${block.type}:${block.level ?? 0}:${index}`;
  }

  private async loadReaderContent(
    presetId: string | null,
    requestedSectionId: string | null,
  ): Promise<void> {
    this.isLoading.set(true);
    this.loadError.set(null);

    try {
      const preset = presetId ? this.presetsService.getById(presetId) : undefined;
      if (!preset) throw new Error('Preset is not available.');

      const document = await this.contentService.getPrayerDocument(preset.assetPath);
      const initialIndex = requestedSectionId
        ? document.sections.findIndex((section) => section.id === requestedSectionId)
        : 0;
      if (requestedSectionId && initialIndex < 0) throw new Error('Requested section is not available.');

      this.prayerTitle.set(document.title);
      this.sections.set(document.sections);
      this.activeSectionIndex.set(Math.max(0, initialIndex));
      requestAnimationFrame(() => {
        this.initializeSwiper();
        const swiper = this.readerSwiper?.nativeElement.swiper;
        swiper?.update();
        swiper?.slideTo(this.activeSectionIndex(), 0, false);
        this.scrollSectionToTop(this.activeSectionIndex());
      });
    } catch {
      this.prayerTitle.set('');
      this.sections.set([]);
      this.activeSectionIndex.set(0);
      this.loadError.set('Failed to load siddur text content.');
    } finally {
      this.isLoading.set(false);
    }
  }

  private initializeSwiper(): void {
    const element = this.readerSwiper?.nativeElement;
    if (!element || element.swiper) return;

    Object.assign(element, {
      init: false,
      initialSlide: this.activeSectionIndex(),
      speed: 250,
      direction: 'horizontal',
      passiveListeners: true,
      touchStartPreventDefault: false,
    });
    element.initialize();
  }

  private getTouchDistance(touches: TouchList): number {
    const horizontalDistance = touches[1].clientX - touches[0].clientX;
    const verticalDistance = touches[1].clientY - touches[0].clientY;
    return Math.hypot(horizontalDistance, verticalDistance);
  }

  private async clearAppCaches(): Promise<void> {
    if (!('caches' in window)) return;

    const cacheNames = await window.caches.keys();
    await Promise.all(
      cacheNames
        .filter((cacheName) => cacheName.startsWith('siddur-app-'))
        .map((cacheName) => window.caches.delete(cacheName)),
    );
  }

  private scrollSectionToTop(index: number): void {
    const slides = this.readerSwiper?.nativeElement.querySelectorAll('swiper-slide');
    const content = slides?.item(index)?.querySelector<HTMLElement>('.reader-section-content');
    content?.scrollTo({ top: 0, behavior: 'instant' });
  }
}
