import { TestBed } from '@angular/core/testing';
import { PrayerDocumentParserService } from './prayer-document-parser.service';

describe('PrayerDocumentParserService', () => {
  let parser: PrayerDocumentParserService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PrayerDocumentParserService] });
    parser = TestBed.inject(PrayerDocumentParserService);
  });

  it('creates an implicit opening section and explicit heading sections', () => {
    const document = parser.parseMarkdownDocument([
      '# תפילה',
      'פתיחה',
      '## חלק ראשון',
      'תוכן',
      '## חלק שני',
      'סיום',
    ].join('\n'), 'test');

    expect(document.title).toBe('תפילה');
    expect(document.sections.map((section) => section.id)).toEqual([
      'main',
      'חלק-ראשון',
      'חלק-שני',
    ]);
    expect(document.sections.map((section) => section.title)).toEqual([
      'תפילה',
      'חלק ראשון',
      'חלק שני',
    ]);
  });

  it('does not create an empty implicit section before the first level-two heading', () => {
    const document = parser.parseMarkdownDocument('# תפילה\n## חלק\nתוכן', 'test');
    expect(document.sections.map((section) => section.title)).toEqual(['חלק']);
  });

  it('keeps a document without level-two headings as one section', () => {
    const document = parser.parseMarkdownDocument('# תפילת הדרך\nתוכן', 'test');
    expect(document.sections).toHaveSize(1);
    expect(document.sections[0].id).toBe('main');
  });

  it('creates unique ids for duplicate headings and parses notes', () => {
    const document = parser.parseMarkdownDocument(
      '# תפילה\n## עמידה\n> הערה\n## עמידה\nתוכן',
      'test',
    );
    expect(document.sections.map((section) => section.id)).toEqual(['עמידה', 'עמידה-2']);
    expect(document.sections[0].blocks[1].type).toBe('comment');
  });

  it('keeps @small content inline within its surrounding paragraph', () => {
    const document = parser.parseMarkdownDocument([
      '# תפילה',
      'טקסט רגיל',
      '@small',
      'טקסט קטן',
      '@endsmall',
      'המשך טקסט רגיל',
    ].join('\n'), 'test');

    const paragraph = document.sections[0].blocks[1];
    expect(document.sections[0].blocks).toHaveSize(2);
    expect(paragraph.type).toBe('paragraph');
    expect(paragraph.segments).toEqual([
      { text: 'טקסט רגיל' },
      { text: ' טקסט קטן', size: 'small' },
      { text: ' המשך טקסט רגיל', size: undefined },
    ]);
  });

  it('keeps comments and following text ordered and small inside @small', () => {
    const document = parser.parseMarkdownDocument([
      '# תפילה',
      'טקסט רגיל',
      '@small',
      '> הערה קטנה',
      'טקסט קטן',
      '@endsmall',
    ].join('\n'), 'test');

    const blocks = document.sections[0].blocks;
    expect(blocks).toHaveSize(4);
    expect(blocks[1].text).toBe('טקסט רגיל');
    expect(blocks[2]).toEqual(jasmine.objectContaining({
      type: 'comment',
      text: 'הערה קטנה',
      size: 'small',
    }));
    expect(blocks[3]).toEqual(jasmine.objectContaining({
      type: 'paragraph',
      text: 'טקסט קטן',
      size: 'small',
      segments: [{ text: 'טקסט קטן', size: 'small' }],
    }));
  });

  it('supports a standalone @small block at the start of a section', () => {
    const document = parser.parseMarkdownDocument([
      '# תפילה',
      '@small',
      'טקסט קטן ראשון',
      'טקסט קטן שני',
      '@endsmall',
      'טקסט רגיל',
    ].join('\n'), 'test');

    const blocks = document.sections[0].blocks;
    expect(blocks).toHaveSize(4);
    expect(blocks[1]).toEqual(jasmine.objectContaining({
      type: 'paragraph',
      text: 'טקסט קטן ראשון',
      size: 'small',
    }));
    expect(blocks[2]).toEqual(jasmine.objectContaining({
      type: 'paragraph',
      text: 'טקסט קטן שני',
      size: 'small',
    }));
    expect(blocks[3]).toEqual(jasmine.objectContaining({
      type: 'paragraph',
      text: 'טקסט רגיל',
      size: undefined,
    }));
  });

  it('rejects invalid small text blocks', () => {
    expect(() => parser.parseMarkdownDocument(
      '# תפילה\nטקסט רגיל\n@small\nטקסט קטן',
      'test',
    )).toThrowError(/Unclosed @small/);
    expect(() => parser.parseMarkdownDocument(
      '# תפילה\n@endsmall',
      'test',
    )).toThrowError(/Unexpected @endsmall/);
  });

  it('rejects content without a prayer title and unclosed conditions', () => {
    expect(() => parser.parseMarkdownDocument('תוכן', 'test')).toThrow();
    expect(() => parser.parseMarkdownDocument('# תפילה\n@if show-tachanun\nתוכן', 'test')).toThrow();
  });

  it('parses @if, @elsif, and @else as mutually exclusive branches', () => {
    const document = parser.parseMarkdownDocument([
      '# תפילה',
      '@if IsSummer',
      'קיץ',
      '@elsif IsWinter1',
      'חורף ראשון',
      '@elsif IsWinter2',
      'חורף שני',
      '@else',
      'אחר',
      '@endif',
    ].join('\n'), 'test');
    const blocks = document.sections[0].blocks.slice(1);

    expect(blocks.map((block) => block.conditions)).toEqual([
      ['IsSummer'],
      ['!IsSummer', 'IsWinter1'],
      ['!IsSummer', '!IsWinter1', 'IsWinter2'],
      ['!IsSummer', '!IsWinter1', '!IsWinter2'],
    ]);
  });

  it('keeps conditional branches inside @small as segments of the surrounding paragraph', () => {
    const document = parser.parseMarkdownDocument([
      '# תפילה',
      'לפני',
      '@small',
      '@if IsSummer',
      'קיץ',
      '@else',
      'חורף',
      '@endif',
      '@endsmall',
      'אחרי',
    ].join('\n'), 'test');
    const paragraph = document.sections[0].blocks[1];

    expect(document.sections[0].blocks).toHaveSize(2);
    expect(paragraph.segments).toEqual([
      { text: 'לפני' },
      { text: ' קיץ', size: 'small', conditions: ['IsSummer'] },
      { text: ' חורף', size: 'small', conditions: ['!IsSummer'] },
      { text: ' אחרי', size: undefined },
    ]);
  });

  it('rejects malformed conditional branches', () => {
    expect(() => parser.parseMarkdownDocument('# תפילה\n@else\nתוכן', 'test'))
      .toThrowError(/Unexpected @else/);
    expect(() => parser.parseMarkdownDocument(
      '# תפילה\n@if IsSummer\nקיץ\n@else\nאחר\n@elsif IsWinter\nחורף\n@endif',
      'test',
    )).toThrowError(/@elsif after @else/);
  });
});
