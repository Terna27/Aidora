import {
  LocationData,
  AccuracyLevel,
  LocationCoordinates,
} from '../../types/emergency';

export interface LocationResolutionResult {
  success: boolean;
  location?: LocationData;
  error?: {
    code: 'PERMISSION_DENIED' | 'LOCATION_UNAVAILABLE' | 'TIMEOUT' | 'UNKNOWN';
    message: string;
  };
}

export interface IGpsProvider {
  requestForegroundPermissionsAsync: () => Promise<{ status: string }>;
  hasServicesEnabledAsync: () => Promise<boolean>;
  getCurrentPositionAsync: (options: { accuracy: number; timeInterval?: number }) => Promise<{
    coords: {
      latitude: number;
      longitude: number;
      accuracy?: number | null;
    };
  }>;
  reverseGeocodeAsync?: (coords: { latitude: number; longitude: number }) => Promise<any[]>;
}

export interface ILocationService {
  acquireGpsLocation(timeoutMs?: number): Promise<LocationResolutionResult>;
  createManualLocation(
    villageCommunity: string,
    landmark: string,
    streetAddress?: string,
    directionsNotes?: string
  ): LocationData;
  formatLocation(loc?: LocationData): string;
}

export class LocationService implements ILocationService {
  private provider: IGpsProvider | null = null;
  private defaultTimeoutMs: number;

  constructor(customProvider?: IGpsProvider, defaultTimeoutMs = 7000) {
    if (customProvider) {
      this.provider = customProvider;
    }
    this.defaultTimeoutMs = defaultTimeoutMs;
  }

  setProvider(provider: IGpsProvider) {
    this.provider = provider;
  }

  private async getProvider(): Promise<IGpsProvider> {
    if (this.provider) return this.provider;
    const Location = await import('expo-location');
    return Location as unknown as IGpsProvider;
  }

  /**
   * Request GPS permission and attempt device position acquisition.
   * Enforces a strict timeout (default 7s) so patients are never left waiting.
   * If GPS is unavailable, denied, or times out, returns structured error
   * prompting manual community/village/landmark entry.
   * NEVER invents coordinates.
   */
  async acquireGpsLocation(timeoutMs = this.defaultTimeoutMs): Promise<LocationResolutionResult> {
    try {
      const locationProvider = await this.getProvider();
      const { status } = await locationProvider.requestForegroundPermissionsAsync();

      if (status !== 'granted') {
        return {
          success: false,
          error: {
            code: 'PERMISSION_DENIED',
            message: 'Location permission was denied. Please enter your community or landmark manually.',
          },
        };
      }

      // Check if location services are enabled on the device hardware
      const isEnabled = await locationProvider.hasServicesEnabledAsync();
      if (!isEnabled) {
        return {
          success: false,
          error: {
            code: 'LOCATION_UNAVAILABLE',
            message: 'Device location / GPS is turned off. Please turn it on or enter your location manually.',
          },
        };
      }

      // Enforce strict Promise timeout for GPS acquisition to prevent hanging indoors or in tunnels
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          const timeoutErr = new Error('GPS acquisition timed out');
          (timeoutErr as any).code = 'TIMEOUT';
          reject(timeoutErr);
        }, timeoutMs);
      });

      const positionPromise = locationProvider.getCurrentPositionAsync({
        accuracy: 3, // Balanced
      });

      const position = await Promise.race([positionPromise, timeoutPromise]);

      const accuracy = position.coords.accuracy ?? 999;
      const accuracyLevel: AccuracyLevel =
        accuracy <= 15 ? 'HIGH' : accuracy <= 50 ? 'MEDIUM' : 'LOW';

      // Attempt reverse geocoding to suggest community if available
      let detectedCommunity = '';
      if (locationProvider.reverseGeocodeAsync) {
        try {
          const reversePromise = locationProvider.reverseGeocodeAsync({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          // 2 second limit on reverse geocode so we don't stall
          const reverseTimeout = new Promise<any[]>((resolve) => setTimeout(() => resolve([]), 2000));
          const reverse = await Promise.race([reversePromise, reverseTimeout]);

          if (reverse && reverse.length > 0) {
            const first = reverse[0];
            detectedCommunity = [first.district, first.subregion, first.city]
              .filter(Boolean)
              .join(', ');
          }
        } catch {
          // Reverse geocoding failure is non-fatal in low connectivity
        }
      }

      const locationData: LocationData = {
        source: 'GPS',
        coords: {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        accuracyMeters: Math.round(accuracy),
        accuracyLevel,
        villageCommunity: detectedCommunity || 'GPS Detected Location',
        landmark: '',
        capturedAt: new Date().toISOString(),
      };

      return {
        success: true,
        location: locationData,
      };
    } catch (err: unknown) {
      const isTimeout =
        (err as any)?.code === 'TIMEOUT' ||
        (err instanceof Error && err.message.toLowerCase().includes('timeout'));

      if (isTimeout) {
        return {
          success: false,
          error: {
            code: 'TIMEOUT',
            message: 'GPS acquisition timed out (weak satellite signal). Please enter your location manually.',
          },
        };
      }

      const errorMessage = err instanceof Error ? err.message : 'Unknown location error';
      return {
        success: false,
        error: {
          code: 'LOCATION_UNAVAILABLE',
          message: `Unable to get GPS signal (${errorMessage}). Please enter your location manually.`,
        },
      };
    }
  }

  /**
   * Create a verified manual location representation.
   * Coords are explicitly undefined to prevent falsifying real coordinates.
   */
  createManualLocation(
    villageCommunity: string,
    landmark: string,
    streetAddress?: string,
    directionsNotes?: string
  ): LocationData {
    return {
      source: 'MANUAL',
      coords: undefined, // NEVER fake coordinates
      accuracyMeters: undefined,
      accuracyLevel: 'APPROXIMATE',
      villageCommunity: villageCommunity.trim(),
      landmark: landmark.trim(),
      streetAddress: streetAddress?.trim(),
      directionsNotes: directionsNotes?.trim(),
      capturedAt: new Date().toISOString(),
    };
  }

  /**
   * Format a user-friendly string describing the location.
   */
  formatLocation(loc?: LocationData): string {
    if (!loc) return 'No location provided';

    if (loc.source === 'GPS' && loc.coords) {
      const accText = loc.accuracyMeters
        ? ` (±${loc.accuracyMeters}m accuracy)`
        : '';
      const community = loc.villageCommunity ? `${loc.villageCommunity} ` : '';
      return `${community}[GPS: ${loc.coords.latitude.toFixed(4)}, ${loc.coords.longitude.toFixed(4)}]${accText}`;
    }

    const parts = [
      loc.villageCommunity,
      loc.landmark ? `Near: ${loc.landmark}` : '',
      loc.streetAddress,
    ].filter(Boolean);

    return parts.join(' • ') || 'Manual Location Entry';
  }
}

export const locationService = new LocationService();
