import { Injectable, inject } from '@angular/core';
import hayomYomData from '../../assets/shiurim/hayom-yom.json';
import { JewishCalendarService } from './jewish-calendar.service';

const hayomYomEntries: Record<string, string> = hayomYomData;

@Injectable({ providedIn: 'root' })
export class HayomYomService {
  private readonly calendar = inject(JewishCalendarService);

  getTodayEntry(): { key: string; text: string } | null {
    return this.getEntry(this.getTodayKey());
  }

  getEntry(key: string): { key: string; text: string } | null {
    const text = hayomYomEntries[key];
    return text ? { key, text } : null;
  }

  getTodayKey(): string {
    const { monthName, dayOfMonth } = this.calendar.today;
    const month = monthName.includes('מנחם אב') || monthName === 'אב'
      ? 'אב'
      : monthName.includes('אדר א')
        ? 'אדר א'
        : monthName.includes('אדר ב')
          ? 'אדר ב'
          : monthName.includes('חשוון') || monthName.includes('חשון')
            ? 'חשון'
            : monthName.includes('סיוון') || monthName.includes('סיון')
              ? 'סיון'
              : monthName.replace(/[״"׳'\s]/gu, '');
    return `${this.toHebrewDay(dayOfMonth)} ${month}`;
  }

  getAdjacentKey(key: string, direction: -1 | 1): string | null {
    const keys = Object.keys(hayomYomEntries);
    const index = keys.indexOf(key);
    const adjacentIndex = index + direction;
    return adjacentIndex >= 0 && adjacentIndex < keys.length ? keys[adjacentIndex] : null;
  }

  getWeekdayForKey(key: string): string {
    const keys = Object.keys(hayomYomEntries);
    const todayIndex = keys.indexOf(this.getTodayKey());
    const targetIndex = keys.indexOf(key);
    if (todayIndex < 0 || targetIndex < 0) return '';

    const date = new Date();
    date.setDate(date.getDate() + targetIndex - todayIndex);
    return new Intl.DateTimeFormat('he-IL', { weekday: 'long' }).format(date);
  }

  private toHebrewDay(day: number): string {
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const values: Record<number, string> = { 10: 'י', 15: 'טו', 16: 'טז', 20: 'כ', 30: 'ל' };
    return `${values[Math.floor(day / 10) * 10] ?? ''}${ones[day % 10]}`;
  }
}
