import { Location } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
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

interface ReaderRenderedSection {
  id: string;
  titleKey: string;
  blocks: ReaderRenderedBlock[];
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
})
export class ReaderPage implements OnInit {
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly visibleSections = signal<ResolvedPrayerSection[]>([]);
  readonly renderedSections = signal<ReaderRenderedSection[]>([]);

  @ViewChild('readerTextBody')
  private readerTextBody?: ElementRef<HTMLElement>;

  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly actionSheetController = inject(ActionSheetController);
  private readonly location = inject(Location);
  private readonly prayerContentService = inject(PrayerContentService);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly router = inject(Router);
  private readonly translateService = inject(TranslateService);
  private longPressTimer?: ReturnType<typeof setTimeout>;
  private longPressStartPoint?: { x: number; y: number };
  private activePressType?: 'pointer' | 'touch';

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

  trackBySection(index: number, section: ResolvedPrayerSection): string {
    return section.id;
  }

  trackByRenderedSection(index: number, section: ReaderRenderedSection): string {
    return section.id;
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

    try {
      if (!presetId) {
        this.loadError.set('Missing preset id.');
        this.visibleSections.set([]);
        this.renderedSections.set([]);
        return;
      }

      const preset = this.prayerPresetsService.getById(presetId);
      if (!preset) {
        this.loadError.set('Preset is not available.');
        this.visibleSections.set([]);
        this.renderedSections.set([]);
        return;
      }

      const requestedSection = requestedSectionId
        ? preset.sections.find((section) => section.id === requestedSectionId)
        : undefined;

      if (requestedSectionId && !requestedSection) {
        this.loadError.set('Requested section is not available.');
        this.visibleSections.set([]);
        this.renderedSections.set([]);
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
      this.renderedSections.set(renderedSections.filter((section) => section.blocks.length > 0));
      this.scrollToSection(requestedSection?.id);
    } catch {
      this.loadError.set('Failed to load siddur text content.');
      this.visibleSections.set([]);
      this.renderedSections.set([]);
    } finally {
      this.isLoading.set(false);
    }
  }

  private scrollToSection(sectionId: string | undefined): void {
    if (!sectionId) {
      return;
    }

    queueMicrotask(() => {
      requestAnimationFrame(() => {
        const container = this.readerTextBody?.nativeElement;
        const target = container?.querySelector<HTMLElement>(`[data-section-id="${sectionId}"]`);
        target?.scrollIntoView({ block: 'start', behavior: 'auto' });
      });
    });
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
