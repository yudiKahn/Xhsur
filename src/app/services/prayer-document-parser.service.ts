import { Injectable } from '@angular/core';
import {
  PrayerBlock,
  PrayerDocument,
  PrayerSectionDocument,
} from '../models/prayer-content.model';
import { PrayerConditionRuleId } from '../models/prayer-preset.model';

const INLINE_MARKER_PATTERN = /^[א-ת][א-ת״"'׳]{0,3}$/u;

@Injectable({
  providedIn: 'root',
})
export class PrayerDocumentParserService {
  parseMarkdownDocument(source: string, documentId: string): PrayerDocument {
    const sections: PrayerSectionDocument[] = [];
    const sectionIdCounts = new Map<string, number>();
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const conditionStack: PrayerConditionRuleId[] = [];
    let documentTitle: string | undefined;
    let currentSection: PrayerSectionDocument | undefined;
    let pendingInlineMarker: { text: string; conditions?: PrayerConditionRuleId[] } | undefined;
    let isSmallText = false;
    let inlineParagraph: PrayerBlock | undefined;
    let appendAfterSmallText = false;

    const finishInlineParagraph = (): void => {
      inlineParagraph = undefined;
      appendAfterSmallText = false;
    };

    const flushPendingMarker = (): void => {
      if (currentSection && pendingInlineMarker) {
        currentSection.blocks.push({
          type: 'comment',
          text: pendingInlineMarker.text,
          level: 6,
          conditions: pendingInlineMarker.conditions,
        });
      }
      pendingInlineMarker = undefined;
    };

    const flushSection = (keepEmpty = false): void => {
      flushPendingMarker();
      if (currentSection && (keepEmpty || currentSection.blocks.length > 1)) {
        sections.push(currentSection);
      }
      currentSection = undefined;
    };

    lines.forEach((rawLine, index) => {
      const lineNumber = index + 1;
      const line = rawLine.trim();
      if (!line) return;

      if (line.startsWith('@if ')) {
        if (isSmallText) throw new Error(`Condition inside @small block at line ${lineNumber}.`);
        finishInlineParagraph();
        const ruleId = line.slice(4).trim() as PrayerConditionRuleId;
        if (!ruleId) throw new Error(`Missing condition rule at line ${lineNumber}.`);
        conditionStack.push(ruleId);
        return;
      }
      if (line === '@endif') {
        if (isSmallText) throw new Error(`Condition inside @small block at line ${lineNumber}.`);
        finishInlineParagraph();
        if (!conditionStack.length) throw new Error(`Unexpected @endif at line ${lineNumber}.`);
        conditionStack.pop();
        return;
      }
      if (line === '@small') {
        if (!documentTitle || !currentSection) {
          throw new Error(`Small text before the prayer title at line ${lineNumber}.`);
        }
        if (isSmallText) throw new Error(`Nested @small at line ${lineNumber}.`);
        flushPendingMarker();
        const previousBlock = currentSection.blocks[currentSection.blocks.length - 1];
        if (previousBlock?.type !== 'paragraph') {
          throw new Error(`@small must follow paragraph text at line ${lineNumber}.`);
        }
        previousBlock.segments ??= [{ text: previousBlock.text }];
        inlineParagraph = previousBlock;
        appendAfterSmallText = false;
        isSmallText = true;
        return;
      }
      if (line === '@endsmall') {
        if (!isSmallText) throw new Error(`Unexpected @endsmall at line ${lineNumber}.`);
        flushPendingMarker();
        isSmallText = false;
        appendAfterSmallText = true;
        return;
      }

      const mainHeadingMatch = /^#\s+(.+)$/.exec(line);
      if (mainHeadingMatch) {
        if (isSmallText) throw new Error(`Heading inside @small block at line ${lineNumber}.`);
        finishInlineParagraph();
        if (documentTitle) throw new Error(`Unexpected main heading at line ${lineNumber}.`);
        documentTitle = mainHeadingMatch[1].trim();
        currentSection = {
          id: 'main',
          title: documentTitle,
          conditions: this.cloneConditions(conditionStack),
          blocks: [{
            type: 'heading',
            text: documentTitle,
            level: 1,
            conditions: this.cloneConditions(conditionStack),
          }],
        };
        return;
      }

      if (!documentTitle || !currentSection) {
        throw new Error(`Content before the prayer title at line ${lineNumber}.`);
      }

      const sectionHeadingMatch = /^##\s+(.+)$/.exec(line);
      if (sectionHeadingMatch) {
        if (isSmallText) throw new Error(`Heading inside @small block at line ${lineNumber}.`);
        finishInlineParagraph();
        flushSection();
        const title = sectionHeadingMatch[1].trim();
        currentSection = {
          id: this.createSectionId(title, sectionIdCounts),
          title,
          conditions: this.cloneConditions(conditionStack),
          blocks: [{
            type: 'heading',
            text: title,
            level: 2,
            conditions: this.cloneConditions(conditionStack),
          }],
        };
        return;
      }

      const nestedHeadingMatch = /^(#{3,6})\s+(.+)$/.exec(line);
      if (nestedHeadingMatch) {
        if (isSmallText) throw new Error(`Heading inside @small block at line ${lineNumber}.`);
        finishInlineParagraph();
        this.pushBlock(currentSection, {
          type: 'heading',
          text: nestedHeadingMatch[2].trim(),
          level: nestedHeadingMatch[1].length as 3 | 4 | 5 | 6,
          conditions: this.cloneConditions(conditionStack),
        }, pendingInlineMarker);
        pendingInlineMarker = undefined;
        return;
      }

      if (line.startsWith('>')) {
        if (isSmallText) throw new Error(`Comment inside @small block at line ${lineNumber}.`);
        finishInlineParagraph();
        const text = line.slice(1).trim();
        if (!text) throw new Error(`Empty comment block at line ${lineNumber}.`);
        const conditions = this.cloneConditions(conditionStack);
        if (this.isInlineMarker(text)) {
          flushPendingMarker();
          pendingInlineMarker = { text, conditions };
          return;
        }
        this.pushBlock(currentSection, { type: 'comment', text, level: 6, conditions }, pendingInlineMarker);
        pendingInlineMarker = undefined;
        return;
      }

      if (inlineParagraph && (isSmallText || appendAfterSmallText)) {
        this.appendTextSegment(inlineParagraph, line, isSmallText ? 'small' : undefined);
        if (appendAfterSmallText) finishInlineParagraph();
        return;
      }

      this.pushBlock(currentSection, {
        type: 'paragraph',
        text: line,
        conditions: this.cloneConditions(conditionStack),
      }, pendingInlineMarker);
      pendingInlineMarker = undefined;
    });

    if (conditionStack.length) throw new Error('Unclosed @if block in prayer source.');
    if (isSmallText) throw new Error('Unclosed @small block in prayer source.');
    if (!documentTitle || !currentSection) throw new Error('Missing prayer title.');
    flushSection(true);

    return { id: documentId, title: documentTitle, sections };
  }

  private appendTextSegment(
    paragraph: PrayerBlock,
    text: string,
    size?: 'small',
  ): void {
    const textWithSpacing = ` ${text}`;
    paragraph.text += textWithSpacing;
    paragraph.segments?.push({ text: textWithSpacing, size });
  }

  private createSectionId(title: string, counts: Map<string, number>): string {
    const baseId = title
      .normalize('NFKD')
      .replace(/[\u0591-\u05BD\u05BF-\u05C7]/g, '')
      .toLocaleLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '-')
      .replace(/^-|-$/g, '') || 'section';
    const occurrence = (counts.get(baseId) ?? 0) + 1;
    counts.set(baseId, occurrence);
    return occurrence === 1 ? baseId : `${baseId}-${occurrence}`;
  }

  private isInlineMarker(value: string): boolean {
    return INLINE_MARKER_PATTERN.test(value);
  }

  private pushBlock(
    section: PrayerSectionDocument,
    block: PrayerBlock,
    marker?: { text: string; conditions?: PrayerConditionRuleId[] },
  ): void {
    if (marker && this.conditionsMatch(block.conditions, marker.conditions)) {
      section.blocks.push({ ...block, marker: marker.text });
      return;
    }
    if (marker) {
      section.blocks.push({ type: 'comment', text: marker.text, level: 6, conditions: marker.conditions });
    }
    section.blocks.push(block);
  }

  private conditionsMatch(left?: PrayerConditionRuleId[], right?: PrayerConditionRuleId[]): boolean {
    return (left?.length ?? 0) === (right?.length ?? 0) &&
      (left ?? []).every((entry, index) => entry === right?.[index]);
  }

  private cloneConditions(conditions: PrayerConditionRuleId[]): PrayerConditionRuleId[] | undefined {
    return conditions.length ? [...conditions] : undefined;
  }
}
