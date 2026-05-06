// https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-javascript-mssql-quickstart?view=azuresql&tabs=passwordless%2Cservice-connector%2Cportal#configure-the-mssql-connection-object
import { log } from "console"
import pg from "pg"
import { Client, Result } from "pg"

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

export let database = null

export default class Database {
  config: Record<string, any> = {}
  client: Client = null
  connected: boolean = false

  constructor(config) {
    this.config = config
  }

  async connect() {
    try {
      this.client = new Client(this.config)
      await this.client.connect()
      this.connected = true
      console.log("Database connected successfully.")
      return this.client
    } catch (error) {
      console.error("Error connecting to the database:", error)
      this.connected = false
    }
  }

  async disconnect() {
    try {
      if (this.connected) {
        await this.client.end()
        this.connected = false
        console.log("Database disconnected successfully.")
      }
    } catch (error) {
      console.error("Error disconnecting from the database:", error)
    }
  }

  /*
   * Gets list of predictions for the next 24 hours.
   * index 0 will be the first row with predicted_time after the current time in unix seconds.
   * Then the following 23 values sorted by predicted_time ascending.
   */
  async getPredictionsNext24Hours(): Promise<WeatherPrediction[]> {
    const result: Result = await this.client.query(
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

    const result: Result = await this.client.query(
      'SELECT predicted_time AS "predictedTime", prediction_offset AS "predictionOffset", temperature, humidity, wind_direction AS "windDirection", wind_speed AS "windSpeed", precipitation, light FROM "WeatherPrediction" WHERE predicted_time >= EXTRACT(EPOCH FROM NOW()) AND predicted_time < EXTRACT(EPOCH FROM NOW()) + $1 * 3600 ORDER BY predicted_time ASC',
      [hoursFromNow],
    )
    return result.rows
  }

  async getPredictionsInRange(
    startTime: number,
    endTime: number,
  ): Promise<WeatherPrediction[]> {
    const result: Result = await this.client.query(
      'SELECT predicted_time AS "predictedTime", prediction_offset AS "predictionOffset", temperature, humidity, wind_direction AS "windDirection", wind_speed AS "windSpeed", precipitation, light FROM "WeatherPrediction" WHERE predicted_time >= $1 AND predicted_time < $2 ORDER BY predicted_time ASC',
      [startTime, endTime],
    )
    return result.rows
  }

  async getLatestWeather(): Promise<Weather> {
    const result: Result = await this.client.query(
      'SELECT time, temperature, humidity, wind_direction AS "windDirection", wind_speed AS "windSpeed", precipitation, light FROM "Weather" WHERE time = (SELECT MAX(time) from "Weather")',
    )
    return result.rows[0]
  }

  async getWeatherInRange(
    startTime: number,
    endTime: number,
  ): Promise<Weather[]> {
    const result: Result = await this.client.query(
      'SELECT time, temperature, humidity, wind_direction AS "windDirection", wind_speed AS "windSpeed", precipitation, light FROM "Weather" WHERE time >= $1 AND time < $2 ORDER BY time ASC',
      [startTime, endTime],
    )
    return result.rows
  }
}

export const createDatabaseConnection = async (PASSWORD_CONFIG) => {
  database = new Database(PASSWORD_CONFIG)
  await database.connect()
  return database
}
