import { Injectable, signal } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { AppLocation } from '../models/app-location.model';

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  readonly currentLocation = signal<AppLocation | null>(null);
  readonly isLoading = signal(false);
  readonly error = signal<string | null>(null);

  async loadCurrentLocation(): Promise<AppLocation | null> {
    if (this.isLoading()) return this.currentLocation();

    this.isLoading.set(true);
    this.error.set(null);

    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: false,
        maximumAge: 15 * 60 * 1000,
        timeout: 12 * 1000,
      });
      const location: AppLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        elevation: position.coords.altitude ?? 0,
        timeZoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      };

      this.currentLocation.set(location);
      return location;
    } catch {
      this.error.set('locationUnavailable');
      return null;
    } finally {
      this.isLoading.set(false);
    }
  }
}
