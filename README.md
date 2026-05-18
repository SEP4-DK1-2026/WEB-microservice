## Database

Uses an .env file in the root to connect to the database. Values are:

```
PSQL_SERVER=
PSQL_DATABASE=
PSQL_PORT=
PSQL_USER=
PSQL_PASSWORD=
```

## HTTP API

All endpoints are `GET` requests.

| Endpoint                                    | Query params                                   | Description                                                                                            |
| ------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `getPredictionNext24Hours()`                | `modelName` (optional)                         | Returns the single prediction closest to now + 24h (prefers same hour; fallback is latest within 24h). |
| `getPredictionsNextHours(hoursFromNow)`     | `hoursFromNow`, `modelName` (optional)         | Returns all predictions from now through `hoursFromNow`.                                               |
| `getPredictionsInRange(startTime, endTime)` | `startTime`, `endTime`, `modelName` (optional) | Unix timestamps (seconds); can return old predictions.                                                 |
| `getPredictionsLastAndNext24Hours()`        | `modelName` (optional)                         | Returns last 24h (prefers offset 24 if available) plus next 24h (lowest offset).                       |
| `getLatestWeather()`                        | None                                           | Returns the latest row from the historical/sensor data table.                                          |
| `getWeatherInRange(startTime, endTime)`     | `startTime`, `endTime`                         | Unix timestamps (seconds); returns historical datapoints.                                              |

Note: `startTime` and `endTime` are always unix timestamps in seconds. `modelName` defaults to `DMI` and accepts `VIA`.
