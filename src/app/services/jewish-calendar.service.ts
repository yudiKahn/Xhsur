import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class JewishCalendarService {
  getCurrentDayLabel(date = new Date()): string {
    const weekday = new Intl.DateTimeFormat('he-IL', {
      weekday: 'long',
    }).format(date);
    const month = new Intl.DateTimeFormat('he-IL-u-ca-hebrew', {
      month: 'long',
    }).format(date);
    const day = Number(
      new Intl.DateTimeFormat('en-u-ca-hebrew', {
        day: 'numeric',
      }).format(date),
    );

    return `${weekday} ${this.toHebrewDay(day)} ${month}`;
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
