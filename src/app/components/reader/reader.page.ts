import { Location } from '@angular/common';
import { Component, DestroyRef, ElementRef, OnInit, ViewChild, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonButton,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonModal,
  IonSpinner,
  IonTitle,
  IonToolbar,
} from '@ionic/angular/standalone';
import { combineLatest } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { PrayerBlock } from '../../models/prayer-content.model';
import { ResolvedPrayerSection } from '../../models/prayer-preset.model';
import { PrayerContentService } from '../../services/prayer-content.service';
import { PrayerPresetsService } from '../../services/prayer-presets.service';

const LONG_PRESS_DURATION_MS = 450;

interface ReaderRenderedSection {
  id: string;
  titleKey: string;
  blocks: PrayerBlock[];
}

@Component({
  selector: 'app-reader',
  templateUrl: './reader.page.html',
  styleUrls: ['./reader.page.scss'],
  standalone: true,
  imports: [
    IonButton,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonModal,
    IonSpinner,
    IonTitle,
    IonToolbar,
    TranslatePipe,
  ],
})
export class ReaderPage implements OnInit {
  readonly isLoading = signal(true);
  readonly isSectionNavigatorOpen = signal(false);
  readonly loadError = signal<string | null>(null);
  readonly visibleSections = signal<ResolvedPrayerSection[]>([]);
  readonly renderedSections = signal<ReaderRenderedSection[]>([]);

  @ViewChild('readerTextBody')
  private readerTextBody?: ElementRef<HTMLElement>;

  private readonly activatedRoute = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly location = inject(Location);
  private readonly prayerContentService = inject(PrayerContentService);
  private readonly prayerPresetsService = inject(PrayerPresetsService);
  private readonly router = inject(Router);
  private longPressTimer?: ReturnType<typeof setTimeout>;
  private longPressTriggered = false;

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

  startLongPress(): void {
    this.cancelLongPress();

    if (!this.canOpenSectionNavigator()) {
      return;
    }

    this.longPressTriggered = false;
    this.longPressTimer = setTimeout(() => {
      this.longPressTriggered = true;
      this.isSectionNavigatorOpen.set(true);
    }, LONG_PRESS_DURATION_MS);
  }

  cancelLongPress(): void {
    if (this.longPressTimer) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = undefined;
    }
  }

  closeSectionNavigator(): void {
    this.isSectionNavigatorOpen.set(false);
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

  async openSection(section: ResolvedPrayerSection): Promise<void> {
    this.closeSectionNavigator();
    this.cancelLongPress();

    await this.router.navigate([], {
      relativeTo: this.activatedRoute,
      queryParams: { section: section.id },
      replaceUrl: true,
    });
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
            blocks,
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
}
