import { MATCH_RADIUS_KM } from "@eve/shared";
import { getHexagonEdgeLengthAvg, gridDisk, latLngToCell, UNITS } from "h3-js";

/** Matching index resolution (~0.46 km edge). */
export const H3_RES_MATCH = 8;

const edgeKm = getHexagonEdgeLengthAvg(H3_RES_MATCH, UNITS.km);

/**
 * Rings needed to cover MATCH_RADIUS_KM. Use edge length (not center spacing) so
 * gridDisk still covers a geographic circle near icosahedron edges / pentagons,
 * where H3 gridDistance can exceed the naive hop count.
 */
export const MATCH_DISK_K = Math.ceil(MATCH_RADIUS_KM / edgeKm) + 1;

export function cellFor(latitude: number, longitude: number) {
  return latLngToCell(latitude, longitude, H3_RES_MATCH);
}

export function diskCells(latitude: number, longitude: number) {
  return gridDisk(cellFor(latitude, longitude), MATCH_DISK_K);
}
