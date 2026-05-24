import { Injectable } from '@angular/core';
import {
  PrayerBlock,
  PrayerDocument,
  PrayerSectionDocument,
} from '../models/prayer-content.model';
import { PrayerConditionRuleId } from '../models/prayer-preset.model';

const SECTION_HEADING_LEVEL = 2;

@Injectable({
  providedIn: 'root',
})
export class PrayerDocumentParserService {
  parseTextDocument(source: string, documentId: string): PrayerDocument {
    const sections: PrayerSectionDocument[] = [];
    const normalizedSource = source.replace(/\r\n/g, '\n');
    const lines = normalizedSource.split('\n');

    let currentSection: PrayerSectionDocument | undefined;
    const conditionStack: PrayerConditionRuleId[] = [];

    lines.forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const line = rawLine.trim();

      if (!line) {
        return;
      }

      if (line.startsWith('@if ')) {
        const ruleId = line.slice(4).trim() as PrayerConditionRuleId;
        if (!ruleId) {
          throw new Error(`Missing condition rule at line ${lineNumber}.`);
        }

        conditionStack.push(ruleId);
        return;
      }

      if (line === '@endif') {
        if (!conditionStack.length) {
          throw new Error(`Unexpected @endif at line ${lineNumber}.`);
        }

        conditionStack.pop();
        return;
      }

      if (line.startsWith('# ')) {
        const sectionMatch = /^#\s+\[([a-z0-9-]+)\]\s+(.+)$/i.exec(line);
        if (!sectionMatch) {
          throw new Error(`Invalid section heading at line ${lineNumber}.`);
        }

        const [, sectionId, title] = sectionMatch;
        currentSection = {
          id: sectionId,
          title,
          blocks: [
            {
              type: 'heading',
              text: title,
              level: SECTION_HEADING_LEVEL,
              conditions: this.cloneConditions(conditionStack),
            },
          ],
        };
        sections.push(currentSection);
        return;
      }

      if (!currentSection) {
        throw new Error(`Content before first section at line ${lineNumber}.`);
      }

      if (line.startsWith('##')) {
        const match = /^(#{2,5})\s+(.+)$/.exec(line);
        if (!match) {
          throw new Error(`Invalid heading marker at line ${lineNumber}.`);
        }

        const [, marker, text] = match;
        currentSection.blocks.push({
          type: 'heading',
          text,
          level: this.toHeadingLevel(marker.length),
          conditions: this.cloneConditions(conditionStack),
        });
        return;
      }

      if (line.startsWith('>')) {
        const text = line.slice(1).trim();
        if (!text) {
          throw new Error(`Empty comment block at line ${lineNumber}.`);
        }

        currentSection.blocks.push({
          type: 'comment',
          text,
          level: 6,
          conditions: this.cloneConditions(conditionStack),
        });
        return;
      }

      currentSection.blocks.push({
        type: 'paragraph',
        text: line,
        conditions: this.cloneConditions(conditionStack),
      });
    });

    if (conditionStack.length) {
      throw new Error('Unclosed @if block in prayer source.');
    }

    return {
      id: documentId,
      sections,
    };
  }

  private toHeadingLevel(markerCount: number): 3 | 4 | 5 | 6 {
    return Math.min(markerCount + 1, 6) as 3 | 4 | 5 | 6;
  }

  private cloneConditions(conditions: PrayerConditionRuleId[]): PrayerConditionRuleId[] | undefined {
    return conditions.length ? [...conditions] : undefined;
  }
}
