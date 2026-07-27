import { Injectable, inject } from '@angular/core';
import { PrayerTimingFlags } from '../models/prayer-preset.model';
import { JewishCalendarService } from './jewish-calendar.service';

@Injectable({
  providedIn: 'root',
})
export class PrayerTimingService {
  private readonly calendar = inject(JewishCalendarService);

  getCurrentFlags(): PrayerTimingFlags {
    return {
      tachanun: this.calendar.ShowTachanun,
      hallel: 'none',
      IsSunday: this.calendar.IsSunday,
      IsMonday: this.calendar.IsMonday,
      IsTuesday: this.calendar.IsTuesday,
      IsWednesday: this.calendar.IsWednesday,
      IsThursday: this.calendar.IsThursday,
      IsFriday: this.calendar.IsFriday,
      IsSaturday: this.calendar.IsSaturday,
    };
  }
}
