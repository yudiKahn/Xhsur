import { Injectable, inject } from '@angular/core';
import hayomYomData from '../../assets/shiurim/hayom-yom.json';
import { JewishCalendarService } from './jewish-calendar.service';

const hayomYomEntries: Record<string, string> = hayomYomData;

@Injectable({ providedIn: 'root' })
export class HayomYomService {
  private readonly calendar = inject(JewishCalendarService);

  getTodayEntry(): { key: string; text: string } | null {
    const key = this.getTodayKey();
    const text = hayomYomEntries[key];
    return text ? { key, text } : null;
  }

  private getTodayKey(): string {
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

  private toHebrewDay(day: number): string {
    const ones = ['', 'א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ז', 'ח', 'ט'];
    const values: Record<number, string> = { 10: 'י', 15: 'טו', 16: 'טז', 20: 'כ', 30: 'ל' };
    return `${values[Math.floor(day / 10) * 10] ?? ''}${ones[day % 10]}`;
  }
}
