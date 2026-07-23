import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PrayerDocument } from '../models/prayer-content.model';
import { PrayerConditionRuleId, PrayerTimingFlags } from '../models/prayer-preset.model';
import { PrayerDocumentParserService } from './prayer-document-parser.service';
import { PrayerTimingService } from './prayer-timing.service';

@Injectable({
  providedIn: 'root',
})
export class PrayerContentService {
  private readonly http = inject(HttpClient);
  private readonly parser = inject(PrayerDocumentParserService);
  private readonly timing = inject(PrayerTimingService);
  private readonly documentCache = new Map<string, PrayerDocument>();

  async getPrayerDocument(assetPath: string): Promise<PrayerDocument> {
    const document = await this.loadPrayerDocument(assetPath);
    const flags = this.timing.getCurrentFlags();

    return {
      ...document,
      sections: document.sections
        .filter((section) => this.conditionsMatch(section.conditions, flags))
        .map((section) => ({
          ...section,
          blocks: section.blocks.filter((block) => this.conditionsMatch(block.conditions, flags)),
        }))
        .filter((section) => section.blocks.length > 0),
    };
  }

  clearDocumentCache(): void {
    this.documentCache.clear();
  }

  private async loadPrayerDocument(assetPath: string): Promise<PrayerDocument> {
    const cached = this.documentCache.get(assetPath);
    if (cached) return cached;

    const source = await firstValueFrom(this.http.get(assetPath, { responseType: 'text' }));
    const documentId = assetPath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? assetPath;
    const document = this.parser.parseMarkdownDocument(source ?? '', documentId);
    this.documentCache.set(assetPath, document);
    return document;
  }

  private conditionsMatch(
    conditions: PrayerConditionRuleId[] | undefined,
    flags: PrayerTimingFlags,
  ): boolean {
    return (conditions ?? []).every((ruleId) => {
      switch (ruleId) {
        case 'show-tachanun': return flags.tachanun;
        case 'show-hallel-any': return flags.hallel !== 'none';
        case 'show-hallel-full': return flags.hallel === 'full';
        case 'show-hallel-partial': return flags.hallel === 'partial';
        default: return true;
      }
    });
  }
}
