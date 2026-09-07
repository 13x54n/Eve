/**
 * Consolidated Location Module
 * 
 * H3 geospatial matching logic integrated into ride service
 * Feature flag: USE_CONSOLIDATED_LOCATION
 */

export { nearbyDrivers, nearbyTrips, indexTrip, removeTrip, updateDriverPosition } from './matching.js';
export { distanceKm as calculateDistance, latLngToH3Cell, h3CellToLatLng } from './geo.js';
export { 
  syncDriverGeoIndex, 
  indexSearchingTrip, 
  removeSearchingTrip,
  recordDriverLocation,
  getDriverPosition,
  getTripPosition,
} from './h3.js';
