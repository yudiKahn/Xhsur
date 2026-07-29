import { Injectable } from '@angular/core';

export interface JewishDate {
  dayOfWeek: number;
  dayOfMonth: number;
  monthName: string;
}

@Injectable({
  providedIn: 'root',
})
export class JewishCalendarService {
  get today(): JewishDate {
    return this.getJewishDate();
  }

  get IsSunday(): boolean {
    return this.today.dayOfWeek === 0;
  }

  get IsMonday(): boolean {
    return this.today.dayOfWeek === 1;
  }

  get IsTuesday(): boolean {
    return this.today.dayOfWeek === 2;
  }

  get IsWednesday(): boolean {
    return this.today.dayOfWeek === 3;
  }

  get IsThursday(): boolean {
    return this.today.dayOfWeek === 4;
  }

  get IsFriday(): boolean {
    return this.today.dayOfWeek === 5;
  }

  get IsSaturday(): boolean {
    return this.today.dayOfWeek === 6;
  }

  get IsSummer(): boolean {
    return this.isSummer();
  }

  get IsWinter(): boolean {
    return this.isWinter1();
  }

  get IsWinter1(): boolean {
    return this.isWinter1();
  }

  get IsWinter2(): boolean {
    return this.isWinter2();
  }

  get ShowTachanun(): boolean {
    return this.showTachanun();
  }

  getJewishDate(date = new Date()): JewishDate {
    return {
      dayOfWeek: date.getDay(),
      dayOfMonth: Number(
        new Intl.DateTimeFormat('en-u-ca-hebrew', {
          day: 'numeric',
        }).format(date),
      ),
      monthName: new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
        month: 'long',
      }).format(date),
    };
  }

  showTachanun(date = new Date()): boolean {
    const { dayOfMonth, monthName } = this.getJewishDate(date);

    return dayOfMonth !== 1 &&
      dayOfMonth !== 30 &&
      monthName !== 'ניסן' &&
      monthName !== 'תשרי';
  }

  isSummer(date = new Date()): boolean {
    const { dayOfMonth, monthName } = this.getJewishDate(date);
    const month = this.getSeasonMonth(monthName);

    return (month === 'nisan' && dayOfMonth > 15) ||
      ['iyar', 'sivan', 'tammuz', 'av', 'elul'].includes(month) ||
      (month === 'tishrei' && dayOfMonth <= 22);
  }

  isWinter1(date = new Date()): boolean {
    const { dayOfMonth, monthName } = this.getJewishDate(date);
    const month = this.getSeasonMonth(monthName);

    return (month === 'tishrei' && dayOfMonth > 22) ||
      ['cheshvan', 'kislev', 'tevet', 'shevat', 'adar'].includes(month) ||
      (month === 'nisan' && dayOfMonth <= 15);
  }

  isWinter2(date = new Date()): boolean {
    const { dayOfMonth, monthName } = this.getJewishDate(date);
    const month = this.getSeasonMonth(monthName);

    return (month === 'cheshvan' && dayOfMonth > 7) ||
      ['kislev', 'tevet', 'shevat', 'adar'].includes(month) ||
      (month === 'nisan' && dayOfMonth <= 15);
  }

  getCurrentDayLabel(date = new Date()): string {
    const weekday = new Intl.DateTimeFormat('he-IL', {
      weekday: 'long',
    }).format(date);
    const { dayOfMonth, monthName } = this.getJewishDate(date);

    return `${weekday} ${this.toHebrewDay(dayOfMonth)} ${monthName}`;
  }

  private toHebrewDay(day: number): string {
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const values: Record<number, string> = {
      10: 'י',
      15: 'טו',
      16: 'טז',
      20: 'כ',
      30: 'ל',
    };
    const letters = values[day] ?? `${values[Math.floor(day / 10) * 10]}${ones[day % 10]}`;

    return letters.length === 1
      ? `${letters}'`
      : `${letters.slice(0, -1)}"${letters.slice(-1)}`;
  }

  private getSeasonMonth(monthName: string): string {
    const normalizedMonth = monthName.replace(/[״"'׳\s-]/g, '');

    if (normalizedMonth.includes('תשרי')) return 'tishrei';
    if (normalizedMonth.includes('חשוון') || normalizedMonth.includes('חשון')) return 'cheshvan';
    if (normalizedMonth.includes('כסלו')) return 'kislev';
    if (normalizedMonth.includes('טבת')) return 'tevet';
    if (normalizedMonth.includes('שבט')) return 'shevat';
    if (normalizedMonth.includes('אדר')) return 'adar';
    if (normalizedMonth.includes('ניסן')) return 'nisan';
    if (normalizedMonth.includes('אייר')) return 'iyar';
    if (normalizedMonth.includes('סיוון') || normalizedMonth.includes('סיון')) return 'sivan';
    if (normalizedMonth.includes('תמוז')) return 'tammuz';
    if (normalizedMonth === 'אב') return 'av';
    if (normalizedMonth.includes('אלול')) return 'elul';
    return '';
  }
}
