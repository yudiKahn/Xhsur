import { TestBed } from '@angular/core/testing';
import { PrayerPresetsService } from './prayer-presets.service';

describe('PrayerPresetsService', () => {
  let service: PrayerPresetsService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PrayerPresetsService] });
    service = TestBed.inject(PrayerPresetsService);
  });

  it('returns only configured Markdown prayers in display order', () => {
    expect(service.getAll().map((preset) => preset.id)).toEqual([
      'shacharit',
      'mincha',
      'birkat-hamazon',
      'tefilat-haderech',
      'maariv',
    ]);
    expect(service.getAll().every((preset) => preset.assetPath.endsWith('.md'))).toBeTrue();
  });

  it('finds a prayer by route id', () => {
    expect(service.getById('shacharit')?.assetPath).toBe('assets/siddur/shacharit.md');
    expect(service.getById('missing')).toBeUndefined();
  });
});
