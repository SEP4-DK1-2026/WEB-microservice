// CODE FROM MAL, ONLY FOR REFERENCE

import {
  app,
  InvocationContext,
  Timer,
  HttpRequest,
  HttpResponseInit,
} from "@azure/functions"

import {
  Weather,
  WeatherPrediction,
  createDatabaseConnection,
  database,
} from "../database.js"
import { PASSWORD_CONFIG } from "../config.js"
import { range } from "../utils.js"

export interface PredictionInput {
  weather: Weather
  predictionOffset: number
}

const API_URL = ""
const HOUR_OFFSETS = [
  ...range(24 * 0 + 1, 24 * 1 + 1, 1), // First day every hour
  ...range(24 * 1 + 2, 24 * 2 + 1, 2), // Second day every other hour
  ...range(24 * 2 + 3, 24 * 4 + 1, 3), // Third and fourth day every three hours
  ...range(24 * 4 + 6, 24 * 6 + 1, 6), // Fifth and sixth day every six hours
  ...range(24 * 6 + 12, 24 * 7 + 1, 12), // Seventh day every 12 hours
]

async function makePrediction(
  input: PredictionInput,
): Promise<WeatherPrediction> {
  return fetch(API_URL)
    .then((res) => res.json())
    .catch((e) => ({
      predictedTime: input.weather.time + input.predictionOffset, // WARNING: Dummy results
      predictionOffset: input.predictionOffset,
      temperature: input.weather.temperature - 1,
      humidity: input.weather.humidity,
      wind_direction: input.weather.windDirection,
      wind_speed: input.weather.windSpeed,
      precipitation: input.weather.precipitation,
      light: input.weather.light + 2,
    }))
}

async function makePredictions(
  weather: Weather,
  offsets: number[],
): Promise<WeatherPrediction[]> {
  return Promise.all(
    offsets.map((offset) =>
      makePrediction({ weather, predictionOffset: offset }),
    ),
  )
}

async function savePrediction(prediction: WeatherPrediction): Promise<void> {
  database.createPrediction(prediction)
}

async function savePredictions(
  predictions: WeatherPrediction[],
): Promise<void> {
  await Promise.all(predictions.map(savePrediction))
}

async function getCurrentWeather(): Promise<Weather> {
  const weather: Record<string, any> = await database.readLatestWeather()
  return {
    time: weather.time,
    temperature: weather.temperature,
    humidity: weather.humidity,
    windDirection: weather.windDirection,
    windSpeed: weather.windSpeed,
    precipitation: weather.precipitation,
    light: weather.light,
  }
}

async function createPredictions() {
  await createDatabaseConnection(PASSWORD_CONFIG)

  const weather: Weather = await getCurrentWeather()
  const predictions: WeatherPrediction[] = await makePredictions(
    weather,
    HOUR_OFFSETS,
  )

  await savePredictions(predictions)
}

export async function createPredictionsTimer(
  myTimer: Timer,
  context: InvocationContext,
): Promise<void> {
  await createPredictions()
}

export async function createPredictionsRequest(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  await createPredictions()
  return {
    status: 200,
  }
}

app.timer("createPredictions", {
  schedule: "0 1 */8 * * *",
  handler: createPredictionsTimer,
})

app.http("createPredictionsRequest", {
  methods: ["POST"],
  authLevel: "anonymous",
  handler: createPredictionsRequest,
})
