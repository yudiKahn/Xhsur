import { Injectable } from '@angular/core';
import { PrayerBlock } from '../models/prayer-content.model';

const MIN_REMAINING_PAGE_SPACE_RATIO = 0.25;
const READER_FONT_FAMILY = '"Drugulin CLM", "Yiddishkeit AlefAlefAlef", "Times New Roman", serif';

export interface ReaderRenderedSection {
  id: string;
  titleKey: string;
  blocks: ReaderRenderedBlock[];
}

export interface ReaderTextPage {
  id: string;
  sectionIds: string[];
  entries: ReaderTextPageEntry[];
}

export interface ReaderTextPageEntry {
  sectionId: string;
  block: ReaderRenderedBlock;
}

export interface ReaderRenderedBlock {
  type: PrayerBlock['type'];
  level?: PrayerBlock['level'];
  segments: ReaderRenderedBlockSegment[];
}

export interface ReaderRenderedBlockSegment {
  marker?: string;
  text: string;
}

@Injectable({
  providedIn: 'root',
})
export class ReaderPaginationService {
  private pageIdCounter = 0;

  paginate(renderedSections: ReaderRenderedSection[], measureHost: HTMLElement, availableHeight: number): ReaderTextPage[] {
    measureHost.replaceChildren();

    if (!renderedSections.length || !availableHeight) {
      return this.buildFallbackPages(renderedSections);
    }

    this.pageIdCounter = 0;

    const pages: ReaderTextPage[] = [];
    let currentEntries: ReaderTextPageEntry[] = [];

    const measurePage = this.createMeasurePage();
    const measureContent = this.createMeasureContent();
    measurePage.appendChild(measureContent);
    measureHost.appendChild(measurePage);

    for (const section of renderedSections) {
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

    return pages.length > 0 ? pages : this.buildFallbackPages(renderedSections);
  }

  getPageIndexForSection(pages: ReaderTextPage[], sectionId: string): number | undefined {
    const pageIndex = pages.findIndex((page) => page.sectionIds.includes(sectionId));
    return pageIndex >= 0 ? pageIndex : undefined;
  }

  resolveInitialPageIndex(pages: ReaderTextPage[], preferredSectionId?: string | null): number {
    if (!pages.length || !preferredSectionId) {
      return 0;
    }

    const pageIndex = this.getPageIndexForSection(pages, preferredSectionId);
    return pageIndex ?? 0;
  }

  private buildFallbackPages(renderedSections: ReaderRenderedSection[]): ReaderTextPage[] {
    return renderedSections.map((section) => ({
      id: section.id,
      sectionIds: [section.id],
      entries: section.blocks.map((block) => ({
        sectionId: section.id,
        block,
      })),
    }));
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
    page.style.display = 'block';
    page.style.width = '100%';
    page.style.height = 'auto';
    return page;
  }

  private createMeasureContent(): HTMLElement {
    const content = document.createElement('article');
    content.className = 'reader-page-content reader-page-content--measure siddur-text-body';
    content.dir = 'rtl';
    content.style.height = 'auto';
    content.style.minHeight = '0';
    content.style.overflow = 'visible';
    content.style.width = '100%';
    content.style.boxSizing = 'border-box';
    content.style.padding = '8px 14px 2em';
    content.style.margin = '0';
    content.style.lineHeight = '1.8';
    content.style.fontSize = '1.08rem';
    content.style.textAlign = 'right';
    content.style.fontFamily = READER_FONT_FAMILY;
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
}
