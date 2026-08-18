import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { PrayerDocument } from '../models/prayer-content.model';
import { PrayerCondition, PrayerTimingFlags } from '../models/prayer-preset.model';
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
          blocks: section.blocks
            .filter((block) => this.conditionsMatch(block.conditions, flags))
            .map((block) => ({
              ...block,
              segments: block.segments?.filter((segment) =>
                this.conditionsMatch(segment.conditions, flags)),
            })),
        }))
        .filter((section) => section.blocks.some((block) => block.type !== 'heading')),
    };
  }

  clearDocumentCache(): void {
    this.documentCache.clear();
  }

  private async loadPrayerDocument(assetPath: string): Promise<PrayerDocument> {
    const cached = this.documentCache.get(assetPath);
    if (cached) return cached;

    const source = await firstValueFrom(this.http.get(assetPath, { responseType: 'text' }));
    const expandedSource = await this.expandIncludes(source ?? '', assetPath, []);
    const documentId = assetPath.split('/').pop()?.replace(/\.[^.]+$/, '') ?? assetPath;
    const document = this.parser.parseMarkdownDocument(expandedSource, documentId);
    this.documentCache.set(assetPath, document);
    return document;
  }

  private async expandIncludes(
    source: string,
    assetPath: string,
    includeStack: string[],
  ): Promise<string> {
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const expandedLines: string[] = [];
    const assetDirectory = assetPath.slice(0, assetPath.lastIndexOf('/') + 1);

    for (const line of lines) {
      const includeMatch = /^@include\s+([A-Za-z0-9_-]+)\s*$/u.exec(line.trim());
      if (!includeMatch) {
        expandedLines.push(line);
        continue;
      }

      const includePath = `${assetDirectory}${includeMatch[1]}.md`;
      if (includeStack.includes(includePath)) {
        throw new Error(`Circular prayer source include: ${includePath}`);
      }

      const includedSource = await firstValueFrom(
        this.http.get(includePath, { responseType: 'text' }),
      );
      expandedLines.push(await this.expandIncludes(
        includedSource ?? '',
        includePath,
        [...includeStack, assetPath],
      ));
    }

    return expandedLines.join('\n');
  }

  private conditionsMatch(
    conditions: PrayerCondition[] | undefined,
    flags: PrayerTimingFlags,
  ): boolean {
    return (conditions ?? []).every((condition) => {
      if (Array.isArray(condition)) {
        return condition.some((ruleId) => this.ruleMatches(ruleId, flags));
      }
      return this.ruleMatches(condition, flags);
    });
  }

  private ruleMatches(ruleId: string, flags: PrayerTimingFlags): boolean {
      const isNegated = ruleId.startsWith('!');
      const ruleName = isNegated ? ruleId.slice(1) : ruleId;
      let matches: boolean;

      switch (ruleName) {
        case 'show-tachanun': matches = flags.tachanun; break;
        case 'show-hallel-any': matches = flags.hallel !== 'none'; break;
        case 'show-hallel-full': matches = flags.hallel === 'full'; break;
        case 'show-hallel-partial': matches = flags.hallel === 'partial'; break;
        case 'IsSummer': matches = flags.IsSummer; break;
        case 'IsWinter': matches = flags.IsWinter; break;
        case 'IsWinter1': matches = flags.IsWinter1; break;
        case 'IsWinter2': matches = flags.IsWinter2; break;
        case 'elul': matches = flags.elul; break;
        case 'IsSunday': matches = flags.IsSunday; break;
        case 'IsMonday': matches = flags.IsMonday; break;
        case 'IsTuesday': matches = flags.IsTuesday; break;
        case 'IsWednesday': matches = flags.IsWednesday; break;
        case 'IsThursday': matches = flags.IsThursday; break;
        case 'IsFriday': matches = flags.IsFriday; break;
        case 'IsSaturday': matches = flags.IsSaturday; break;
        case 'roshChodesh': matches = flags.roshChodesh; break;
        default: return true;
      }
      return isNegated ? !matches : matches;
  }
}
