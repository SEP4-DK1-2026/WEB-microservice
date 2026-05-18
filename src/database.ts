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

export interface WeatherPrediction {
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

  async getPredictionsNext24Hours(
    modelName = "DMI",
  ): Promise<WeatherPrediction[]> {
    const result: Result = await this.getClient().query(
      `
      WITH ranked AS (
        SELECT
          wp.predicted_time,
          wp.prediction_offset,
          wp.temperature,
          wp.humidity,
          wp.wind_direction,
          wp.wind_speed,
          wp.precipitation,
          wp.light,
          ROW_NUMBER() OVER (
            PARTITION BY wp.predicted_time
            ORDER BY wp.prediction_offset ASC
          ) AS rn
        FROM "WeatherPrediction" wp
        WHERE wp.model_name = $1
          AND wp.predicted_time >= EXTRACT(EPOCH FROM NOW())
          AND wp.predicted_time < EXTRACT(EPOCH FROM NOW()) + 24 * 3600
      )
      SELECT
        predicted_time AS "predictedTime",
        prediction_offset AS "predictionOffset",
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM ranked
      WHERE rn = 1
      ORDER BY predicted_time ASC
      `,
      [modelName],
    )

    return result.rows
  }

  async getPredictionsNextHours(
    hoursFromNow: number,
    modelName = "DMI",
  ): Promise<WeatherPrediction[]> {
    const MAX_HOURS = 7 * 24

    if (!Number.isFinite(hoursFromNow) || hoursFromNow <= 0) {
      throw new Error("hoursFromNow must be a positive finite number")
    }

    if (hoursFromNow > MAX_HOURS) {
      throw new RangeError(`hoursFromNow must not exceed ${MAX_HOURS} (7 days)`)
    }

    const result: Result = await this.getClient().query(
      `
      WITH ranked AS (
        SELECT
          wp.predicted_time,
          wp.prediction_offset,
          wp.temperature,
          wp.humidity,
          wp.wind_direction,
          wp.wind_speed,
          wp.precipitation,
          wp.light,
          ROW_NUMBER() OVER (
            PARTITION BY wp.predicted_time
            ORDER BY wp.prediction_offset ASC
          ) AS rn
        FROM "WeatherPrediction" wp
        WHERE wp.model_name = $2
          AND wp.predicted_time >= EXTRACT(EPOCH FROM NOW())
          AND wp.predicted_time < EXTRACT(EPOCH FROM NOW()) + $1 * 3600
      )
      SELECT
        predicted_time AS "predictedTime",
        prediction_offset AS "predictionOffset",
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM ranked
      WHERE rn = 1
      ORDER BY predicted_time ASC
      `,
      [hoursFromNow, modelName],
    )

    return result.rows
  }

  async getPredictionsLastAndNext24Hours(
    modelName = "DMI",
  ): Promise<WeatherPrediction[]> {
    const result: Result = await this.getClient().query(
      `
      WITH params AS (
        SELECT
          EXTRACT(EPOCH FROM NOW()) AS now_epoch,
          EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours') AS start_epoch,
          EXTRACT(EPOCH FROM NOW() + INTERVAL '24 hours') AS end_epoch
      ),
      past_ranked AS (
        SELECT
          wp.predicted_time,
          wp.prediction_offset,
          wp.temperature,
          wp.humidity,
          wp.wind_direction,
          wp.wind_speed,
          wp.precipitation,
          wp.light,
          ROW_NUMBER() OVER (
            PARTITION BY wp.predicted_time
            ORDER BY
              CASE WHEN wp.prediction_offset = 24 THEN 0 ELSE 1 END,
              wp.prediction_offset ASC
          ) AS rn
        FROM "WeatherPrediction" wp
        CROSS JOIN params p
        WHERE wp.model_name = $1
          AND wp.predicted_time >= p.start_epoch
          AND wp.predicted_time < p.now_epoch
      ),
      future_ranked AS (
        SELECT
          wp.predicted_time,
          wp.prediction_offset,
          wp.temperature,
          wp.humidity,
          wp.wind_direction,
          wp.wind_speed,
          wp.precipitation,
          wp.light,
          ROW_NUMBER() OVER (
            PARTITION BY wp.predicted_time
            ORDER BY wp.prediction_offset ASC
          ) AS rn
        FROM "WeatherPrediction" wp
        CROSS JOIN params p
        WHERE wp.model_name = $1
          AND wp.predicted_time >= p.now_epoch
          AND wp.predicted_time < p.end_epoch
      ),
      past AS (
        SELECT
          predicted_time,
          prediction_offset,
          temperature,
          humidity,
          wind_direction,
          wind_speed,
          precipitation,
          light
        FROM past_ranked
        WHERE rn = 1
      ),
      future AS (
        SELECT
          predicted_time,
          prediction_offset,
          temperature,
          humidity,
          wind_direction,
          wind_speed,
          precipitation,
          light
        FROM future_ranked
        WHERE rn = 1
      )
      SELECT
        predicted_time AS "predictedTime",
        prediction_offset AS "predictionOffset",
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM past
      UNION ALL
      SELECT
        predicted_time AS "predictedTime",
        prediction_offset AS "predictionOffset",
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM future
      ORDER BY 1 ASC
      `,
      [modelName],
    )

    return result.rows
  }

  async getPredictionClosestToNext24Hours(
    modelName = "DMI",
  ): Promise<WeatherPrediction | null> {
    const result: Result = await this.getClient().query(
      `
      WITH params AS (
        SELECT
          EXTRACT(EPOCH FROM NOW()) AS now_epoch,
          EXTRACT(EPOCH FROM NOW() + INTERVAL '24 hours') AS target_epoch,
          date_trunc('hour', NOW() + INTERVAL '24 hours') AS target_hour_start,
          date_trunc('hour', NOW() + INTERVAL '24 hours') + INTERVAL '1 hour' AS target_hour_end
      ),
      ranked AS (
        SELECT
          wp.predicted_time,
          wp.prediction_offset,
          wp.temperature,
          wp.humidity,
          wp.wind_direction,
          wp.wind_speed,
          wp.precipitation,
          wp.light,
          ROW_NUMBER() OVER (
            PARTITION BY wp.predicted_time
            ORDER BY wp.prediction_offset ASC
          ) AS rn
        FROM "WeatherPrediction" wp
        CROSS JOIN params p
        WHERE wp.model_name = $1
          AND wp.predicted_time >= p.now_epoch
          AND wp.predicted_time <= p.target_epoch
      ),
      dedup AS (
        SELECT
          predicted_time,
          prediction_offset,
          temperature,
          humidity,
          wind_direction,
          wind_speed,
          precipitation,
          light
        FROM ranked
        WHERE rn = 1
      ),
      preferred AS (
        SELECT
          predicted_time,
          prediction_offset,
          temperature,
          humidity,
          wind_direction,
          wind_speed,
          precipitation,
          light
        FROM dedup
        CROSS JOIN params p
        WHERE to_timestamp(predicted_time) >= p.target_hour_start
          AND to_timestamp(predicted_time) < p.target_hour_end
        ORDER BY ABS(predicted_time - p.target_epoch) ASC, prediction_offset ASC
        LIMIT 1
      ),
      fallback AS (
        SELECT
          predicted_time,
          prediction_offset,
          temperature,
          humidity,
          wind_direction,
          wind_speed,
          precipitation,
          light
        FROM dedup
        ORDER BY predicted_time DESC, prediction_offset ASC
        LIMIT 1
      )
      SELECT
        predicted_time AS "predictedTime",
        prediction_offset AS "predictionOffset",
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM preferred
      UNION ALL
      SELECT
        predicted_time AS "predictedTime",
        prediction_offset AS "predictionOffset",
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM fallback
      WHERE NOT EXISTS (SELECT 1 FROM preferred)
      LIMIT 1
      `,
      [modelName],
    )

    return result.rows[0] ?? null
  }

  async getPredictionsInRange(
    startTime: number,
    endTime: number,
    modelName = "DMI",
  ): Promise<WeatherPrediction[]> {
    const result: Result = await this.getClient().query(
      `
      WITH ranked AS (
        SELECT
          wp.predicted_time,
          wp.prediction_offset,
          wp.temperature,
          wp.humidity,
          wp.wind_direction,
          wp.wind_speed,
          wp.precipitation,
          wp.light,
          ROW_NUMBER() OVER (
            PARTITION BY wp.predicted_time
            ORDER BY wp.prediction_offset ASC
          ) AS rn
        FROM "WeatherPrediction" wp
        WHERE wp.model_name = $3
          AND wp.predicted_time >= $1
          AND wp.predicted_time < $2
      )
      SELECT
        predicted_time AS "predictedTime",
        prediction_offset AS "predictionOffset",
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM ranked
      WHERE rn = 1
      ORDER BY predicted_time ASC
      `,
      [startTime, endTime, modelName],
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

export const createDatabaseConnection = async (
  PASSWORD_CONFIG: Record<string, unknown>,
) => {
  const sharedPool = getPool(PASSWORD_CONFIG)
  const client = await sharedPool.connect()
  database = new Database(client)
  return database
}
