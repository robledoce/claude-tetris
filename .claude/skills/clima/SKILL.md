---
name: clima
description: Consulta el clima actual (temperatura, sensación térmica, humedad, viento y estado del cielo) de cualquier ciudad usando la API pública Open-Meteo. Úsala cuando el usuario pida el clima, la temperatura o el estado del tiempo de una ciudad. Si no se indica ciudad, usa Lima, Perú por defecto.
---

La ciudad pedida está en `ARGUMENTS`. Si viene vacío, usá "Lima, Perú" por defecto.

## 1. Geocodificar la ciudad

Hacé un GET con WebFetch a la API de geocoding de Open-Meteo para obtener latitud, longitud y zona horaria:

```
https://geocoding-api.open-meteo.com/v1/search?name=<CIUDAD>&count=1&language=es&format=json
```

Reemplazá `<CIUDAD>` por el nombre de la ciudad (URL-encoded). Del primer resultado (`results[0]`) tomá `latitude`, `longitude`, `name`, `country` y `timezone`.

Si no hay resultados, informá al usuario que no se encontró la ciudad y no sigas.

Si el resultado no trae `timezone` (por ejemplo, al buscar un país en vez de una ciudad), usá `auto` como zona horaria y avisá al usuario que el resultado corresponde al centroide geográfico, no a una ciudad puntual.

## 2. Consultar el clima

Con esas coordenadas, hacé un GET con WebFetch a:

```
https://api.open-meteo.com/v1/forecast?latitude=<LAT>&longitude=<LON>&current=temperature_2m,apparent_temperature,weather_code,relative_humidity_2m,wind_speed_10m&timezone=<TIMEZONE>
```

Extraé del bloque `current`: `temperature_2m`, `apparent_temperature`, `weather_code`, `relative_humidity_2m`, `wind_speed_10m` y `time`.

## 3. Traducir el estado del cielo

Traducí `weather_code` (código WMO) a texto en español usando esta tabla:

| Código | Estado |
|---|---|
| 0 | Despejado |
| 1 | Mayormente despejado |
| 2 | Parcialmente nublado |
| 3 | Nublado |
| 45, 48 | Niebla |
| 51, 53, 55 | Llovizna |
| 61, 63, 65 | Lluvia |
| 71, 73, 75 | Nieve |
| 80, 81, 82 | Chubascos |
| 95 | Tormenta eléctrica |
| 96, 99 | Tormenta con granizo |

## 4. Reportar

Reportá el resultado al usuario en una sola línea breve, con ciudad, hora, temperatura, sensación térmica, estado del cielo, humedad y viento. Ejemplo:

> Lima, 16:00 — 23.2°C (sensación 23.9°C), cielo despejado, humedad 69%, viento 12.5 km/h.

Si algún GET falla, informá el error sin reintentar agresivamente.
