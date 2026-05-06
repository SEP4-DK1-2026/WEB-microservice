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
Available GET requests from API:

```
getPredictionsNextHours(hoursFromNow) // Returns all predictions within the range of now, and the number of hours from now
getPredictionsInRange(startDate, endDate) // Params must be unix timestamps. Can return old predictions.

getLatestWeather() // Returns the latest row from the historical/sensor data table
getWeatherInRange(startDate, endDate) // Params must be unix timestamps. Returns historical datapoints.
```
