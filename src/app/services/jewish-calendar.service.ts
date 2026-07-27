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
}
