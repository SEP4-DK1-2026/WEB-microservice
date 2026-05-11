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

| Endpoint                                    | Query params           | Description                                                                                            |
| ------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------ |
| `getPredictionNext24Hours()`                | None                   | Returns the single prediction closest to now + 24h (prefers same hour; fallback is latest within 24h). |
| `getPredictionsNextHours(hoursFromNow)`     | `hoursFromNow`         | Returns all predictions from now through `hoursFromNow`.                                               |
| `getPredictionsInRange(startTime, endTime)` | `startTime`, `endTime` | Unix timestamps (seconds); can return old predictions.                                                 |
| `getLatestWeather()`                        | None                   | Returns the latest row from the historical/sensor data table.                                          |
| `getWeatherInRange(startTime, endTime)`     | `startTime`, `endTime` | Unix timestamps (seconds); returns historical datapoints.                                              |

Note: `startTime` and `endTime` are always unix timestamps in seconds.
