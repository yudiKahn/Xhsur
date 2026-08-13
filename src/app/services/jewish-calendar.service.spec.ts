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
    expect(service.showTachanun(new Date(2026, 7, 14, 12))).toBeFalse();
    expect(service.showTachanun(new Date(2026, 2, 25, 12))).toBeFalse();
    expect(service.showTachanun(new Date(2026, 8, 20, 12))).toBeFalse();
  });

  it('says Tachanon on a regular weekday', () => {
    expect(service.showTachanun(new Date(2026, 6, 26, 12))).toBeTrue();
  });

  it('identifies both days of Rosh Chodesh', () => {
    spyOn(service, 'getJewishDate').and.returnValues(
      { dayOfWeek: 1, dayOfMonth: 1, monthName: 'אב' },
      { dayOfWeek: 2, dayOfMonth: 30, monthName: 'תמוז' },
      { dayOfWeek: 3, dayOfMonth: 2, monthName: 'אלול' },
    );

    expect(service.isRoshChodesh()).toBeTrue();
    expect(service.isRoshChodesh()).toBeTrue();
    expect(service.isRoshChodesh()).toBeFalse();
  });

  it('switches from summer to winter after 22 Tishrei', () => {
    spyOn(service, 'getJewishDate').and.returnValues(
      { dayOfWeek: 0, dayOfMonth: 22, monthName: 'תשרי' },
      { dayOfWeek: 1, dayOfMonth: 23, monthName: 'תשרי' },
      { dayOfWeek: 1, dayOfMonth: 23, monthName: 'תשרי' },
    );

    expect(service.isSummer()).toBeTrue();
    expect(service.isSummer()).toBeFalse();
    expect(service.isWinter1()).toBeTrue();
  });

  it('starts the second winter period after 7 Mar-Cheshvan', () => {
    spyOn(service, 'getJewishDate').and.returnValues(
      { dayOfWeek: 0, dayOfMonth: 7, monthName: 'מרחשוון' },
      { dayOfWeek: 1, dayOfMonth: 8, monthName: 'מרחשוון' },
    );

    expect(service.isWinter2()).toBeFalse();
    expect(service.isWinter2()).toBeTrue();
  });

  it('switches from winter to summer after 15 Nisan', () => {
    spyOn(service, 'getJewishDate').and.returnValues(
      { dayOfWeek: 0, dayOfMonth: 15, monthName: 'ניסן' },
      { dayOfWeek: 1, dayOfMonth: 16, monthName: 'ניסן' },
    );

    expect(service.isWinter1()).toBeTrue();
    expect(service.isSummer()).toBeTrue();
  });
});
