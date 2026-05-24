import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PrayerBlock, PrayerDocument, PrayerSectionDocument } from '../models/prayer-content.model';
import {
  PrayerConditionRuleId,
  PrayerTimingFlags,
  ResolvedPrayerSection,
} from '../models/prayer-preset.model';
import { PrayerDocumentParserService } from './prayer-document-parser.service';
import { PrayerTimingService } from './prayer-timing.service';

@Injectable({
  providedIn: 'root',
})
export class PrayerContentService {
  private readonly http = inject(HttpClient);
  private readonly prayerDocumentParserService = inject(PrayerDocumentParserService);
  private readonly prayerTimingService = inject(PrayerTimingService);
  private readonly documentCache = new Map<string, Document>();
  private readonly textDocumentCache = new Map<string, PrayerDocument>();

  async getSectionBlocks(section: ResolvedPrayerSection): Promise<PrayerBlock[]> {
    const flags = this.prayerTimingService.getCurrentFlags();

    if (section.sourceFormat === 'text') {
      const document = await this.getPrayerDocument(section.assetPath);
      const sectionDocument = this.findDocumentSection(document, section);
      return this.filterBlocks(sectionDocument.blocks, flags);
    }

    const document = await this.getHtmlDocument(section.assetPath);
    const blocks = this.extractHtmlSectionBlocks(document, section);

    return this.filterBlocks(blocks, flags);
  }

  private async getPrayerDocument(assetPath: string): Promise<PrayerDocument> {
    const cached = this.textDocumentCache.get(assetPath);
    if (cached !== undefined) {
      return cached;
    }

    const response$ = this.http.get(assetPath, { responseType: 'text' });
    const source = await firstValueFrom(response$);
    const documentId = this.toDocumentId(assetPath);
    const parsedDocument = this.prayerDocumentParserService.parseTextDocument(source ?? '', documentId);

    this.textDocumentCache.set(assetPath, parsedDocument);
    return parsedDocument;
  }

  private async getHtmlDocument(assetPath: string): Promise<Document> {
    const cached = this.documentCache.get(assetPath);
    if (cached !== undefined) {
      return cached;
    }

    const response$ = this.http.get(assetPath, { responseType: 'text' });
    const html = await firstValueFrom(response$);
    const normalizedDocument = this.normalizeHtml(html ?? '');

    this.documentCache.set(assetPath, normalizedDocument);
    return normalizedDocument;
  }

  private findDocumentSection(
    document: PrayerDocument,
    section: ResolvedPrayerSection,
  ): PrayerSectionDocument {
    const sectionId = section.documentSectionId ?? section.id;
    const sectionDocument = document.sections.find((entry) => entry.id === sectionId);

    if (!sectionDocument) {
      throw new Error(`Missing text section: ${sectionId}`);
    }

    return sectionDocument;
  }

  private normalizeHtml(html: string): Document {
    const parsed = new DOMParser().parseFromString(html, 'text/html');

    parsed.querySelectorAll('script, style, noscript').forEach((element) => {
      element.remove();
    });

    return parsed;
  }

  private extractHtmlSectionBlocks(
    document: Document,
    section: Pick<ResolvedPrayerSection, 'startHeading' | 'endHeading'>,
  ): PrayerBlock[] {
    const body = document.body;
    if (!body) {
      return [];
    }

    const headingElements = Array.from(body.children).filter((element) =>
      /^H[1-6]$/.test(element.tagName),
    );

    const scopedElements = this.scopeHeadingElements(headingElements, section);
    return scopedElements
      .map((element) => this.mapHeadingElementToBlock(element))
      .filter((block): block is PrayerBlock => block !== undefined);
  }

  private scopeHeadingElements(
    headingElements: Element[],
    section: Pick<ResolvedPrayerSection, 'startHeading' | 'endHeading'>,
  ): Element[] {
    if (!section.startHeading) {
      return headingElements;
    }

    const startIndex = headingElements.findIndex((element) =>
      this.matchesHeading(element, section.startHeading!),
    );

    if (startIndex === -1) {
      throw new Error(`Missing start heading: ${section.startHeading}`);
    }

    let endIndex = headingElements.length;
    if (section.endHeading) {
      const resolvedEndIndex = headingElements.findIndex(
        (element, index) => index > startIndex && this.matchesHeading(element, section.endHeading!),
      );

      if (resolvedEndIndex !== -1) {
        endIndex = resolvedEndIndex;
      }
    }

    return headingElements.slice(startIndex, endIndex);
  }

  private mapHeadingElementToBlock(element: Element): PrayerBlock | undefined {
    const text = this.normalizeText(element.textContent);
    if (!text) {
      return undefined;
    }

    const level = Number(element.tagName.slice(1)) as 1 | 2 | 3 | 4 | 5 | 6;
    if (level === 1) {
      return {
        type: 'paragraph',
        text,
      };
    }

    if (level === 6) {
      return {
        type: 'comment',
        text,
        level,
      };
    }

    return {
      type: 'heading',
      text,
      level,
    };
  }

  private filterBlocks(blocks: PrayerBlock[], flags: PrayerTimingFlags): PrayerBlock[] {
    return blocks.filter((block) =>
      (block.conditions ?? []).every((ruleId) => this.matchesRule(ruleId, flags)),
    );
  }

  private matchesRule(ruleId: PrayerConditionRuleId, flags: PrayerTimingFlags): boolean {
    switch (ruleId) {
      case 'show-tachanun':
        return flags.tachanun;
      case 'show-hallel-any':
        return flags.hallel !== 'none';
      case 'show-hallel-full':
        return flags.hallel === 'full';
      case 'show-hallel-partial':
        return flags.hallel === 'partial';
      default:
        return true;
    }
  }

  private matchesHeading(element: Element, expected: string): boolean {
    return this.normalizeText(element.textContent) === this.normalizeText(expected);
  }

  private normalizeText(value: string | null | undefined): string {
    return (value ?? '').replace(/\s+/g, ' ').trim();
  }

  private toDocumentId(assetPath: string): string {
    return assetPath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? assetPath;
  }
}
