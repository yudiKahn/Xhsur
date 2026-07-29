import { Injectable } from '@angular/core';
import { ComplexZmanimCalendar, GeoLocation } from 'kosher-zmanim';
import { AppLocation } from '../models/app-location.model';
import { DailyZmanim } from '../models/daily-zmanim.model';

@Injectable({
  providedIn: 'root',
})
export class ZmanimService {
  calculate(location: AppLocation, date = new Date()): DailyZmanim {
    const geoLocation = new GeoLocation(
      null,
      location.latitude,
      location.longitude,
      location.elevation,
      location.timeZoneId,
    );
    const calendar = new ComplexZmanimCalendar(geoLocation);
    calendar.setDate(date);

    return {
      alos: this.formatTime(calendar.getAlosBaalHatanya(), location.timeZoneId),
      sunrise: this.formatTime(calendar.getSunrise(), location.timeZoneId),
      sunset: this.formatTime(calendar.getSunset(), location.timeZoneId),
      tzais: this.formatTime(calendar.getTzaisBaalHatanya(), location.timeZoneId),
    };
  }

  private formatTime(
    value: { toJSDate(): Date } | null,
    timeZoneId: string,
  ): string | null {
    if (!value) return null;

    return new Intl.DateTimeFormat('he-IL', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: timeZoneId,
    }).format(value.toJSDate());
  }
}
