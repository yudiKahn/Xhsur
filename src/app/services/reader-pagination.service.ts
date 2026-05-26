import { Injectable } from '@angular/core';
import { PrayerBlock } from '../models/prayer-content.model';

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

interface ReaderFlowToken {
  kind: 'marker' | 'text';
  text: string;
}

interface ReaderBuildingFragment {
  sectionId: string;
  block: ReaderRenderedBlock;
  entry: ReaderTextPageEntry;
  element: HTMLElement;
  tokens: ReaderFlowToken[];
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
    let currentFragment: ReaderBuildingFragment | undefined;

    const measurePage = this.createMeasurePage();
    const measureContent = this.createMeasureContent();
    measurePage.appendChild(measureContent);
    measureHost.appendChild(measurePage);

    for (const section of renderedSections) {
      for (const block of section.blocks) {
        const tokens = this.createTokensFromBlock(block);
        currentFragment = undefined;

        for (const token of tokens) {
          if (!currentFragment) {
            currentFragment = this.createBuildingFragment(section.id, block);
            measureContent.appendChild(currentFragment.element);
          }

          this.appendToken(currentFragment, token);

          if (this.getContentHeight(measureContent) <= availableHeight) {
            continue;
          }

          this.removeLastToken(currentFragment);

          if (currentFragment.tokens.length > 0) {
            currentEntries.push(currentFragment.entry);
            pages.push(this.finalizeTextPage(currentEntries));

            currentEntries = [];
            measureContent.replaceChildren();
            currentFragment = this.createBuildingFragment(section.id, block);
            measureContent.appendChild(currentFragment.element);
            continue;
          }

          if (currentEntries.length > 0) {
            pages.push(this.finalizeTextPage(currentEntries));
            currentEntries = [];
            measureContent.replaceChildren();
            currentFragment = this.createBuildingFragment(section.id, block);
            measureContent.appendChild(currentFragment.element);
            continue;
          }

          // A single token is larger than an empty page; keep it to avoid a dead end.
          this.appendToken(currentFragment, token);
        }

        if (currentFragment && currentFragment.tokens.length > 0) {
          currentEntries.push(currentFragment.entry);
          currentFragment = undefined;
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
    content.style.overflow = 'visible';
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

  private createBuildingFragment(sectionId: string, block: ReaderRenderedBlock): ReaderBuildingFragment {
    const element = document.createElement(this.getBlockTagName(block)) as HTMLElement;
    const entry: ReaderTextPageEntry = {
      sectionId,
      block: {
        type: block.type,
        level: block.level,
        segments: [],
      },
    };

    return {
      sectionId,
      block: entry.block,
      entry,
      element,
      tokens: [],
    };
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

  private appendToken(fragment: ReaderBuildingFragment, token: ReaderFlowToken): void {
    fragment.tokens.push(token);
    this.syncFragment(fragment);
  }

  private removeLastToken(fragment: ReaderBuildingFragment): void {
    fragment.tokens.pop();
    this.syncFragment(fragment);
  }

  private syncFragment(fragment: ReaderBuildingFragment): void {
    const segments: ReaderRenderedBlockSegment[] = [];

    for (const token of fragment.tokens) {
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

    fragment.block.segments = segments;
    fragment.element.replaceChildren(...this.tokensToNodes(fragment.tokens));
  }

  private tokensToNodes(tokens: ReaderFlowToken[]): Node[] {
    const nodes: Node[] = [];

    for (const token of tokens) {
      if (token.kind === 'marker') {
        const marker = document.createElement('span');
        marker.className = 'siddur-inline-marker';
        marker.textContent = token.text;
        nodes.push(marker);
        continue;
      }

      nodes.push(document.createTextNode(token.text));
    }

    return nodes;
  }

  private getContentHeight(content: HTMLElement): number {
    return content.getBoundingClientRect().height;
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
