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
}

export type PredictionModelName = "DMI" | "VIA"

export let database: Database | null = null

let pool: Pool | null = null

function getPool(config: Record<string, unknown>): Pool {
  if (!pool) {
    pool = new Pool(config)
  }

  return pool
}

const SCHEMA_NAME = "sep4dk1"

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
    modelName: PredictionModelName = "DMI",
  ): Promise<WeatherPrediction[]> {
    const result: Result = await this.getClient().query(
      `
      SELECT
        FLOOR(EXTRACT(EPOCH FROM NOW()) + prediction_offset * 3600) AS "predictedTime",
        prediction_offset AS "predictionOffset",
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM "${SCHEMA_NAME}"."WeatherPrediction"
      WHERE prediction_offset >= 0
        AND prediction_offset < 24
        AND model_name = $1
      ORDER BY prediction_offset ASC
      `,
      [modelName],
    )

    return result.rows
  }

  async getPredictionsNextHours(
    hoursFromNow: number,
    modelName: PredictionModelName = "DMI",
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
      SELECT
        FLOOR(EXTRACT(EPOCH FROM NOW()) + prediction_offset * 3600) AS "predictedTime",
        prediction_offset AS "predictionOffset",
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM "${SCHEMA_NAME}"."WeatherPrediction"
      WHERE prediction_offset >= 0
        AND prediction_offset < $1
        AND model_name = $2
      ORDER BY prediction_offset ASC
      `,
      [hoursFromNow, modelName],
    )

    return result.rows
  }

  async getPredictionClosestToNext24Hours(
    modelName: PredictionModelName = "DMI",
  ): Promise<WeatherPrediction | null> {
    const result: Result = await this.getClient().query(
      `
      SELECT
        FLOOR(EXTRACT(EPOCH FROM NOW()) + prediction_offset * 3600) AS "predictedTime",
        prediction_offset AS "predictionOffset",
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM "${SCHEMA_NAME}"."WeatherPrediction"
      WHERE model_name = $1
      ORDER BY ABS(prediction_offset - 24) ASC
      LIMIT 1
      `,
      [modelName],
    )

    return result.rows[0] ?? null
  }

  async getPredictionsInRange(
    startTime: number,
    endTime: number,
    modelName: PredictionModelName = "DMI",
  ): Promise<WeatherPrediction[]> {
    const result: Result = await this.getClient().query(
      `
      WITH predictions AS (
        SELECT
          FLOOR(EXTRACT(EPOCH FROM NOW()) + prediction_offset * 3600) AS predicted_time,
          prediction_offset,
          temperature,
          humidity,
          wind_direction,
          wind_speed,
          precipitation,
          light
        FROM "${SCHEMA_NAME}"."WeatherPrediction"
        WHERE model_name = $3
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
      FROM predictions
      WHERE predicted_time >= $1
        AND predicted_time < $2
      ORDER BY predicted_time ASC
      `,
      [startTime, endTime, modelName],
    )

    return result.rows
  }

  async getLatestWeather(): Promise<Weather> {
    const result: Result = await this.getClient().query(
      `
      SELECT
        time,
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM "${SCHEMA_NAME}"."Weather"
      WHERE time = (
        SELECT MAX(time)
        FROM "${SCHEMA_NAME}"."Weather"
      )
      `,
    )

    return result.rows[0]
  }

  async getWeatherInRange(
    startTime: number,
    endTime: number,
  ): Promise<Weather[]> {
    const result: Result = await this.getClient().query(
      `
      SELECT
        time,
        temperature,
        humidity,
        wind_direction AS "windDirection",
        wind_speed AS "windSpeed",
        precipitation,
        light
      FROM "${SCHEMA_NAME}"."Weather"
      WHERE time >= $1
        AND time < $2
      ORDER BY time ASC
      `,
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