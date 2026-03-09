# Geojsons.com

View, edit and share geojsons.

Uses React, Deck.gl, Nebula.gl and Zustand.

## Map Providers

The app supports two map tile providers, each offering vector and satellite styles:

- **MapTiler** — Uses the MapTiler API directly. Styles are fetched as standard MapLibre style JSON.
- **Mapbox** — Uses Mapbox styles via a custom `mapbox://` protocol handler (`src/map/mapboxProtocol.ts`) that translates `mapbox://` URLs into HTTPS API calls compatible with MapLibre GL. This is necessary because MapLibre doesn't natively understand Mapbox's proprietary protocol. The handler also patches Mapbox TileJSON responses to use HTTPS tile URLs, since Mapbox returns legacy `http://` URLs that browsers block as mixed content on HTTPS sites.

Both providers require API keys configured via environment variables:

| Variable                | Description                                                    |
| ----------------------- | -------------------------------------------------------------- |
| `VITE_MAPTILER_API_KEY` | [MapTiler](https://www.maptiler.com/) API key                  |
| `VITE_MAPBOX_API_KEY`   | [Mapbox](https://www.mapbox.com/) public access token (`pk.*`) |
