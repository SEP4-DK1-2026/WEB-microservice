// https://learn.microsoft.com/en-us/azure/azure-sql/database/azure-sql-javascript-mssql-quickstart?view=azuresql&tabs=passwordless%2Cservice-connector%2Cportal#configure-the-mssql-connection-object
import { log } from "console"
import pg from "pg"
import { Client, Result } from "pg"

// Contains code from MAL for reference

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

  // Only for reference, will be removed before deployment
  async createPrediction(prediction: WeatherPrediction) {
    const result = await this.client.query(
      `INSERT INTO "WeatherPrediction" (predicted_time, prediction_offset, temperature, humidity, wind_direction, wind_speed, precipitation, light) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        prediction.predictedTime,
        prediction.predictionOffset,
        prediction.temperature,
        prediction.humidity,
        prediction.windDirection,
        prediction.windSpeed,
        prediction.precipitation,
        prediction.light,
      ],
    )

    return result.rows[0]
  }

  async readLatestWeather(): Promise<Weather> {
    const result: Result = await this.client.query(
      'SELECT * FROM "Weather" WHERE time = (SELECT MAX(time) from "Weather")',
    )

    if (result.rowCount == 0)
      // WARNING: Dummy result
      return {
        time: Math.floor(Date.now() / 1000),
        temperature: 10,
        humidity: 90,
        windDirection: 0,
        windSpeed: 3,
        precipitation: 0,
        light: 50,
      }
    return result.rows[0]
  }
}

export const createDatabaseConnection = async (PASSWORD_CONFIG) => {
  database = new Database(PASSWORD_CONFIG)
  await database.connect()
  return database
}
