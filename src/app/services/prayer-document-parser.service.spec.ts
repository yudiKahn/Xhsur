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

  it('rejects invalid small text blocks', () => {
    expect(() => parser.parseMarkdownDocument(
      '# תפילה\nטקסט רגיל\n@small\nטקסט קטן',
      'test',
    )).toThrowError(/Unclosed @small/);
    expect(() => parser.parseMarkdownDocument(
      '# תפילה\n@endsmall',
      'test',
    )).toThrowError(/Unexpected @endsmall/);
    expect(() => parser.parseMarkdownDocument(
      '# תפילה\n@small\nטקסט קטן\n@endsmall',
      'test',
    )).toThrowError(/must follow paragraph text/);
  });

  it('rejects content without a prayer title and unclosed conditions', () => {
    expect(() => parser.parseMarkdownDocument('תוכן', 'test')).toThrow();
    expect(() => parser.parseMarkdownDocument('# תפילה\n@if show-tachanun\nתוכן', 'test')).toThrow();
  });
});
