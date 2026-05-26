import { Injectable } from '@angular/core';
import { PrayerBlock } from '../models/prayer-content.model';

const READER_FONT_FAMILY = '"Drugulin CLM", "Yiddishkeit AlefAlefAlef", "Times New Roman", serif';
const PAGE_FIT_SAFETY_PX = 40;

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

interface ReaderFlowToken {
  kind: 'marker' | 'text';
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

    const flushCurrentPage = (): void => {
      if (!currentEntries.length) {
        return;
      }

      pages.push(this.finalizeTextPage(currentEntries));
      currentEntries = [];
      measureContent.replaceChildren();
    };

    for (const section of renderedSections) {
      for (const block of section.blocks) {
        let remainingTokens = this.createTokensFromBlock(block);

        while (remainingTokens.length > 0) {
          const fittingTokenCount = this.findFittingTokenCount(
            measureContent,
            section.id,
            block,
            remainingTokens,
            availableHeight,
          );

          if (fittingTokenCount <= 0) {
            if (currentEntries.length > 0) {
              flushCurrentPage();
              continue;
            }

            const forcedTokens = remainingTokens.slice(0, 1);
            const forcedEntry = this.createEntryFromTokens(section.id, block, forcedTokens);
            currentEntries.push(forcedEntry);
            measureContent.appendChild(this.renderEntry(forcedEntry));
            remainingTokens = remainingTokens.slice(1);

            if (remainingTokens.length > 0) {
              flushCurrentPage();
            }

            continue;
          }

          const chunkTokens = remainingTokens.slice(0, fittingTokenCount);
          const chunkEntry = this.createEntryFromTokens(section.id, block, chunkTokens);
          currentEntries.push(chunkEntry);
          measureContent.appendChild(this.renderEntry(chunkEntry));
          remainingTokens = remainingTokens.slice(fittingTokenCount);

          if (remainingTokens.length > 0) {
            flushCurrentPage();
          }
        }
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
    content.style.overflow = 'hidden';
    content.style.width = '100%';
    content.style.boxSizing = 'border-box';
    content.style.padding = '8px 14px';
    content.style.margin = '0';
    content.style.lineHeight = '1.8';
    content.style.fontSize = '1.08rem';
    content.style.textAlign = 'right';
    content.style.fontFamily = READER_FONT_FAMILY;
    return content;
  }

  private createTokensFromBlock(block: ReaderRenderedBlock): ReaderFlowToken[] {
    const tokens: ReaderFlowToken[] = [];

    for (const segment of block.segments) {
      if (segment.marker) {
        tokens.push({
          kind: 'marker',
          text: segment.marker,
        });
      }

      for (const textToken of this.tokenizeText(segment.text)) {
        tokens.push({
          kind: 'text',
          text: textToken,
        });
      }
    }

    return tokens;
  }

  private tokenizeText(text: string): string[] {
    return text.match(/\s+|\S+/g) ?? [];
  }

  private createEntryFromTokens(
    sectionId: string,
    block: ReaderRenderedBlock,
    tokens: ReaderFlowToken[],
  ): ReaderTextPageEntry {
    const segments: ReaderRenderedBlockSegment[] = [];

    for (const token of tokens) {
      if (token.kind === 'marker') {
        segments.push({
          marker: token.text,
          text: '',
        });
        continue;
      }

      const lastSegment = segments[segments.length - 1];
      if (!lastSegment) {
        segments.push({
          text: token.text,
        });
        continue;
      }

      lastSegment.text += token.text;
    }

    return {
      sectionId,
      block: {
        type: block.type,
        level: block.level,
        segments,
      },
    };
  }

  private renderEntry(entry: ReaderTextPageEntry): HTMLElement {
    const element = document.createElement(this.getBlockTagName(entry.block));

    for (const segment of entry.block.segments) {
      if (segment.marker) {
        const marker = document.createElement('span');
        marker.className = 'siddur-inline-marker';
        marker.textContent = segment.marker;
        element.appendChild(marker);
      }

      if (segment.text) {
        element.appendChild(document.createTextNode(segment.text));
      }
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

  private findFittingTokenCount(
    measureContent: HTMLElement,
    sectionId: string,
    block: ReaderRenderedBlock,
    remainingTokens: ReaderFlowToken[],
    availableHeight: number,
  ): number {
    if (!remainingTokens.length) {
      return 0;
    }

    const effectiveAvailableHeight = Math.max(0, availableHeight - PAGE_FIT_SAFETY_PX);
    let low = 0;
    let high = remainingTokens.length;
    let best = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidateEntry = this.createEntryFromTokens(sectionId, block, remainingTokens.slice(0, mid));
      const candidateElement = this.renderEntry(candidateEntry);

      measureContent.appendChild(candidateElement);
      const fits = measureContent.getBoundingClientRect().height <= effectiveAvailableHeight;
      measureContent.removeChild(candidateElement);

      if (fits) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    return best;
  }
}
