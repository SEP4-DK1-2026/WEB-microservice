// https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-javascript-mssql-quickstart?view=azuresql&tabs=passwordless%2Cservice-connector%2Cportal#configure-the-mssql-connection-object
import { Pool, PoolClient, Result } from "pg"

export interface Weather {
  time: number
  temperature: number
  humidity: number
  windDirection: number
  windSpeed: number
  precipitation: number
  light: number
}

export interface WeatherPrediction extends Weather {
  predictedTime: number
  predictionOffset: number
  temperature: number
  humidity: number
  windDirection: number
  windSpeed: number
  precipitation: number
  light: number
}

export let database: Database | null = null

let pool: Pool | null = null

function getPool(config: Record<string, unknown>): Pool {
  if (!pool) {
    pool = new Pool(config)
  }

  return pool
}

export default class Database {
  client: PoolClient | null = null

  constructor(client: PoolClient) {
    this.client = client
  }

  async disconnect() {
    if (this.client) {
      this.client.release()
      this.client = null
    }
  }

  private getClient(): PoolClient {
    if (!this.client) {
      throw new Error("Database client is not available")
    }

    return this.client
  }

  /**
   * Gets list of predictions for the next 24 hours.
   * index 0 will be the first row with predicted_time after the current time in unix seconds.
   * Then the following 23 values sorted by predicted_time ascending.
   */
  async getPredictionsNext24Hours(): Promise<WeatherPrediction[]> {
    const result: Result = await this.getClient().query(
      'SELECT predicted_time AS "predictedTime", prediction_offset AS "predictionOffset", temperature, humidity, wind_direction AS "windDirection", wind_speed AS "windSpeed", precipitation, light FROM "WeatherPrediction" WHERE predicted_time >= EXTRACT(EPOCH FROM NOW()) AND predicted_time < EXTRACT(EPOCH FROM NOW()) + 24 * 3600 ORDER BY predicted_time ASC',
    )
    return result.rows
  }

  async getPredictionsNextHours(
    hoursFromNow: number,
  ): Promise<WeatherPrediction[]> {
    const MAX_HOURS = 7 * 24

    if (!Number.isFinite(hoursFromNow) || hoursFromNow <= 0) {
      throw new Error("hoursFromNow must be a positive finite number")
    }

    if (hoursFromNow > MAX_HOURS) {
      throw new RangeError(`hoursFromNow must not exceed ${MAX_HOURS} (7 days)`)
    }

    const result: Result = await this.getClient().query(
      'SELECT predicted_time AS "predictedTime", prediction_offset AS "predictionOffset", temperature, humidity, wind_direction AS "windDirection", wind_speed AS "windSpeed", precipitation, light FROM "WeatherPrediction" WHERE predicted_time >= EXTRACT(EPOCH FROM NOW()) AND predicted_time < EXTRACT(EPOCH FROM NOW()) + $1 * 3600 ORDER BY predicted_time ASC',
      [hoursFromNow],
    )
    return result.rows
  }

  /**
   * Prefer a prediction in the same hour as now + 24h (closest minute), else return the latest within 24h.
   */
  async getPredictionClosestToNext24Hours(): Promise<WeatherPrediction | null> {
    const result: Result = await this.getClient().query(
      "WITH params AS (\n" +
        "  SELECT\n" +
        "    EXTRACT(EPOCH FROM NOW()) AS now_epoch,\n" +
        "    EXTRACT(EPOCH FROM NOW() + INTERVAL '24 hours') AS target_epoch,\n" +
        "    date_trunc('hour', NOW() + INTERVAL '24 hours') AS target_hour_start,\n" +
        "    date_trunc('hour', NOW() + INTERVAL '24 hours') + INTERVAL '1 hour' AS target_hour_end\n" +
        ")\n" +
        ", preferred AS (\n" +
        "  SELECT\n" +
        '    wp.predicted_time AS "predictedTime",\n' +
        '    wp.prediction_offset AS "predictionOffset",\n' +
        "    wp.temperature,\n" +
        "    wp.humidity,\n" +
        '    wp.wind_direction AS "windDirection",\n' +
        '    wp.wind_speed AS "windSpeed",\n' +
        "    wp.precipitation,\n" +
        "    wp.light\n" +
        '  FROM "WeatherPrediction" wp\n' +
        "  CROSS JOIN params p\n" +
        "  WHERE wp.predicted_time >= p.now_epoch\n" +
        "    AND wp.predicted_time <= p.target_epoch\n" +
        "    AND to_timestamp(wp.predicted_time) >= p.target_hour_start\n" +
        "    AND to_timestamp(wp.predicted_time) < p.target_hour_end\n" +
        "  ORDER BY ABS(wp.predicted_time - p.target_epoch) ASC, wp.predicted_time ASC\n" +
        "  LIMIT 1\n" +
        ")\n" +
        ", fallback AS (\n" +
        "  SELECT\n" +
        '    wp.predicted_time AS "predictedTime",\n' +
        '    wp.prediction_offset AS "predictionOffset",\n' +
        "    wp.temperature,\n" +
        "    wp.humidity,\n" +
        '    wp.wind_direction AS "windDirection",\n' +
        '    wp.wind_speed AS "windSpeed",\n' +
        "    wp.precipitation,\n" +
        "    wp.light\n" +
        '  FROM "WeatherPrediction" wp\n' +
        "  CROSS JOIN params p\n" +
        "  WHERE wp.predicted_time >= p.now_epoch\n" +
        "    AND wp.predicted_time <= p.target_epoch\n" +
        "  ORDER BY wp.predicted_time DESC\n" +
        "  LIMIT 1\n" +
        ")\n" +
        "SELECT * FROM preferred\n" +
        "UNION ALL\n" +
        "SELECT * FROM fallback\n" +
        "WHERE NOT EXISTS (SELECT 1 FROM preferred)\n" +
        "LIMIT 1",
    )

    return result.rows[0] ?? null
  }

  async getPredictionsInRange(
    startTime: number,
    endTime: number,
  ): Promise<WeatherPrediction[]> {
    const result: Result = await this.getClient().query(
      'SELECT predicted_time AS "predictedTime", prediction_offset AS "predictionOffset", temperature, humidity, wind_direction AS "windDirection", wind_speed AS "windSpeed", precipitation, light FROM "WeatherPrediction" WHERE predicted_time >= $1 AND predicted_time < $2 ORDER BY predicted_time ASC',
      [startTime, endTime],
    )
    return result.rows
  }

  async getLatestWeather(): Promise<Weather> {
    const result: Result = await this.getClient().query(
      'SELECT time, temperature, humidity, wind_direction AS "windDirection", wind_speed AS "windSpeed", precipitation, light FROM "Weather" WHERE time = (SELECT MAX(time) from "Weather")',
    )
    return result.rows[0]
  }

  async getWeatherInRange(
    startTime: number,
    endTime: number,
  ): Promise<Weather[]> {
    const result: Result = await this.getClient().query(
      'SELECT time, temperature, humidity, wind_direction AS "windDirection", wind_speed AS "windSpeed", precipitation, light FROM "Weather" WHERE time >= $1 AND time < $2 ORDER BY time ASC',
      [startTime, endTime],
    )
    return result.rows
  }
}

export const createDatabaseConnection = async (PASSWORD_CONFIG) => {
  const sharedPool = getPool(PASSWORD_CONFIG)
  const client = await sharedPool.connect()
  database = new Database(client)
  return database
}
