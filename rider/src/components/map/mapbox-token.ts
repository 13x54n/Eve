import { setAccessToken } from "@rnmapbox/maps";
import { MAPBOX_ACCESS_TOKEN } from "./config";

if (MAPBOX_ACCESS_TOKEN) {
  void setAccessToken(MAPBOX_ACCESS_TOKEN);
}
