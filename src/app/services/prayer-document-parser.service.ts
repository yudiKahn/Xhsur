import { Injectable } from '@angular/core';
import {
  PrayerBlock,
  PrayerDocument,
  PrayerSectionDocument,
} from '../models/prayer-content.model';
import {
  PrayerCondition,
  PrayerConditionRuleId,
  PrayerConditionRuleName,
} from '../models/prayer-preset.model';

const INLINE_MARKER_PATTERN = /^[א-ת][א-ת״"'׳]{0,3}$/u;

interface ConditionFrame {
  parentConditions: PrayerCondition[];
  previousRules: PrayerConditionRuleName[][];
  currentRules?: PrayerConditionRuleName[];
  hasElse: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class PrayerDocumentParserService {
  parseMarkdownDocument(source: string, documentId: string): PrayerDocument {
    const sections: PrayerSectionDocument[] = [];
    const sectionIdCounts = new Map<string, number>();
    const lines = source.replace(/\r\n/g, '\n').split('\n');
    const conditionStack: ConditionFrame[] = [];
    let documentTitle: string | undefined;
    let currentSection: PrayerSectionDocument | undefined;
    let pendingInlineMarker: { text: string; conditions?: PrayerCondition[] } | undefined;
    let isSmallText = false;
    let inlineParagraph: PrayerBlock | undefined;
    let appendAfterSmallText = false;

    const getConditions = (): PrayerCondition[] => {
      const frame = conditionStack[conditionStack.length - 1];
      if (!frame) return [];
      const previousConditions: PrayerConditionRuleId[] = [];
      frame.previousRules.forEach((rules) => {
        rules.forEach((rule) => previousConditions.push(`!${rule}` as PrayerConditionRuleId));
      });
      return [
        ...frame.parentConditions,
        ...previousConditions,
        ...(frame.currentRules?.length ? [
          frame.currentRules.length === 1
            ? frame.currentRules[0]
            : [...frame.currentRules] as PrayerConditionRuleId[],
        ] : []),
      ];
    };

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

      const conditionMatch = /^@(if|elsif)\s*(?:\((.*)\)|(.*))$/u.exec(line);
      if (conditionMatch?.[1] === 'if') {
        if (!isSmallText) finishInlineParagraph();
        const rules = this.parseConditionRules(conditionMatch[2] ?? conditionMatch[3], lineNumber);
        conditionStack.push({
          parentConditions: getConditions(),
          previousRules: [],
          currentRules: rules,
          hasElse: false,
        });
        return;
      }
      if (conditionMatch?.[1] === 'elsif') {
        if (!isSmallText) finishInlineParagraph();
        const frame = conditionStack[conditionStack.length - 1];
        if (!frame) throw new Error(`Unexpected @elsif at line ${lineNumber}.`);
        if (frame.hasElse) throw new Error(`@elsif after @else at line ${lineNumber}.`);
        const rules = this.parseConditionRules(conditionMatch[2] ?? conditionMatch[3], lineNumber);
        if (frame.currentRules) frame.previousRules.push(frame.currentRules);
        frame.currentRules = rules;
        return;
      }
      if (line === '@else') {
        if (!isSmallText) finishInlineParagraph();
        const frame = conditionStack[conditionStack.length - 1];
        if (!frame) throw new Error(`Unexpected @else at line ${lineNumber}.`);
        if (frame.hasElse) throw new Error(`Duplicate @else at line ${lineNumber}.`);
        if (frame.currentRules) frame.previousRules.push(frame.currentRules);
        frame.currentRules = undefined;
        frame.hasElse = true;
        return;
      }
      if (line === '@endif') {
        if (!isSmallText) finishInlineParagraph();
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
        if (previousBlock?.type === 'paragraph') {
          previousBlock.segments ??= [{ text: previousBlock.text }];
          inlineParagraph = previousBlock;
        } else {
          inlineParagraph = undefined;
        }
        appendAfterSmallText = false;
        isSmallText = true;
        return;
      }
      if (line === '@endsmall') {
        if (!isSmallText) throw new Error(`Unexpected @endsmall at line ${lineNumber}.`);
        flushPendingMarker();
        isSmallText = false;
        appendAfterSmallText = !!inlineParagraph;
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
          conditions: this.cloneConditions(getConditions()),
          blocks: [{
            type: 'heading',
            text: documentTitle,
            level: 1,
            conditions: this.cloneConditions(getConditions()),
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
          conditions: this.cloneConditions(getConditions()),
          blocks: [{
            type: 'heading',
            text: title,
            level: 2,
            conditions: this.cloneConditions(getConditions()),
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
          conditions: this.cloneConditions(getConditions()),
        }, pendingInlineMarker);
        pendingInlineMarker = undefined;
        return;
      }

      if (line.startsWith('>')) {
        const text = line.slice(1).trim();
        if (!text) throw new Error(`Empty comment block at line ${lineNumber}.`);
        finishInlineParagraph();
        const conditions = this.cloneConditions(getConditions());
        if (this.isInlineMarker(text)) {
          flushPendingMarker();
          pendingInlineMarker = { text, conditions };
          return;
        }
        this.pushBlock(currentSection, {
          type: 'comment',
          text,
          size: isSmallText ? 'small' : undefined,
          level: 6,
          conditions,
        }, pendingInlineMarker);
        pendingInlineMarker = undefined;
        return;
      }

      if (inlineParagraph && (isSmallText || appendAfterSmallText)) {
        this.appendTextSegment(
          inlineParagraph,
          line,
          isSmallText ? 'small' : undefined,
          this.cloneConditions(getConditions()),
        );
        if (appendAfterSmallText) finishInlineParagraph();
        return;
      }

      this.pushBlock(currentSection, {
        type: 'paragraph',
        text: line,
        size: isSmallText ? 'small' : undefined,
        segments: isSmallText ? [{ text: line, size: 'small' }] : undefined,
        conditions: this.cloneConditions(getConditions()),
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
    conditions?: PrayerCondition[],
  ): void {
    const textWithSpacing = ` ${text}`;
    paragraph.text += textWithSpacing;
    paragraph.segments?.push({
      text: textWithSpacing,
      size,
      ...(conditions ? { conditions } : {}),
    });
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
    marker?: { text: string; conditions?: PrayerCondition[] },
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

  private conditionsMatch(left?: PrayerCondition[], right?: PrayerCondition[]): boolean {
    return (left?.length ?? 0) === (right?.length ?? 0) &&
      (left ?? []).every((entry, index) => {
        const other = right?.[index];
        return Array.isArray(entry) && Array.isArray(other)
          ? entry.length === other.length && entry.every((rule, ruleIndex) => rule === other[ruleIndex])
          : entry === other;
      });
  }

  private cloneConditions(conditions: PrayerCondition[]): PrayerCondition[] | undefined {
    return conditions.length
      ? conditions.map((condition) => Array.isArray(condition) ? [...condition] : condition)
      : undefined;
  }

  private parseConditionRules(expression: string | undefined, lineNumber: number): PrayerConditionRuleName[] {
    const rules = (expression ?? '').split('||').map((rule) => rule.trim()).filter(Boolean);
    if (!rules.length || rules.some((rule) => !/^[A-Za-z][A-Za-z0-9-]*$/u.test(rule))) {
      throw new Error(`Invalid condition expression at line ${lineNumber}.`);
    }
    return rules as PrayerConditionRuleName[];
  }
}
