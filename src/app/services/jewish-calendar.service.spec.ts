import { TestBed } from '@angular/core/testing';
import { JewishCalendarService } from './jewish-calendar.service';

describe('JewishCalendarService', () => {
  let service: JewishCalendarService;

  beforeEach(() => {
    service = TestBed.inject(JewishCalendarService);
  });

  it('formats the current day as a Hebrew weekday and date', () => {
    expect(service.getCurrentDayLabel(new Date(2026, 6, 26, 12))).toBe('יום ראשון י"ב אב');
  });

  it('uses the traditional spellings for the fifteenth and sixteenth', () => {
    expect(service.getCurrentDayLabel(new Date(2026, 6, 29, 12))).toBe('יום רביעי ט"ו אב');
    expect(service.getCurrentDayLabel(new Date(2026, 6, 30, 12))).toBe('יום חמישי ט"ז אב');
  });

  it('exposes the weekday and Hebrew month parts', () => {
    expect(service.getJewishDate(new Date(2026, 6, 26, 12))).toEqual({
      dayOfWeek: 0,
      dayOfMonth: 12,
      monthName: 'אב',
    });
  });

  it('does not say Tachanon on Rosh Chodesh, during Nisan, or during Tishrei', () => {
    expect(service.isTachanonOn(new Date(2026, 7, 14, 12))).toBeFalse();
    expect(service.isTachanonOn(new Date(2026, 2, 25, 12))).toBeFalse();
    expect(service.isTachanonOn(new Date(2026, 8, 20, 12))).toBeFalse();
  });

  it('says Tachanon on a regular weekday', () => {
    expect(service.isTachanonOn(new Date(2026, 6, 26, 12))).toBeTrue();
  });
});
