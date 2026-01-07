import { useState, useCallback } from 'react';

/**
 * useLocation - Hook for managing browser geolocation
 *
 * Provides access to the user's location with proper permission handling.
 * Location data is transient (not persisted by this hook) for privacy.
 *
 * Status values:
 * - 'idle': Initial state, location not requested
 * - 'requesting': Permission dialog shown, waiting for user
 * - 'granted': Location obtained successfully
 * - 'denied': User denied permission or location unavailable
 * - 'unavailable': Geolocation API not supported
 *
 * @returns {Object} Location state and controls
 */
export function useLocation() {
  const [location, setLocation] = useState(null);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  /**
   * Request location from browser
   * @returns {Promise<Object|null>} Location object or null if failed
   */
  const requestLocation = useCallback(async () => {
    // Check for geolocation support
    if (!navigator?.geolocation) {
      setStatus('unavailable');
      setError('Geolocation is not supported by your browser');
      return null;
    }

    setStatus('requesting');
    setError(null);

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            source: 'browser'
          };
          setLocation(loc);
          setStatus('granted');
          setError(null);
          resolve(loc);
        },
        (err) => {
          const errorMessage = getGeolocationErrorMessage(err);
          setError(errorMessage);
          setStatus('denied');
          resolve(null);
        },
        {
          enableHighAccuracy: false, // City-level accuracy is sufficient
          timeout: 10000, // 10 second timeout
          maximumAge: 300000 // Cache position for 5 minutes
        }
      );
    });
  }, []);

  /**
   * Clear cached location data
   */
  const clearLocation = useCallback(() => {
    setLocation(null);
    setStatus('idle');
    setError(null);
  }, []);

  return {
    location,
    status,
    error,
    requestLocation,
    clearLocation,
    isAvailable: status !== 'unavailable',
    isGranted: status === 'granted',
    isRequesting: status === 'requesting'
  };
}

/**
 * Get user-friendly error message for geolocation errors
 */
function getGeolocationErrorMessage(error) {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission was denied';
    case error.POSITION_UNAVAILABLE:
      return 'Location information is unavailable';
    case error.TIMEOUT:
      return 'Location request timed out';
    default:
      return 'An unknown error occurred getting your location';
  }
}

export default useLocation;
