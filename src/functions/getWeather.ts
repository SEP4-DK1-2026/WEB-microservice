import {
  app,
  HttpRequest,
  HttpResponseInit,
  InvocationContext,
} from "@azure/functions"

import Database, { createDatabaseConnection } from "../database.js"
import { PASSWORD_CONFIG } from "../config.js"

function jsonResponse(body: unknown, status = 200): HttpResponseInit {
  return {
    status,
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  }
}

async function withDatabase<T>(
  handler: (database: Database) => Promise<T>,
): Promise<T> {
  const database = await createDatabaseConnection(PASSWORD_CONFIG)

  try {
    return await handler(database)
  } finally {
    await database.disconnect()
  }
}

export async function getLatestWeather(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  try {
    const weatherReading = await withDatabase((database) =>
      database.getLatestWeather(),
    )

    return jsonResponse(weatherReading)
  } catch (err) {
    context.log("Database error in getLatestWeather", err)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
}

export async function getWeatherInRange(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const startTime = Number(request.query.get("startTime"))
  const endTime = Number(request.query.get("endTime"))

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return jsonResponse(
      {
        error:
          "Query parameters 'startTime' and 'endTime' are required and must be numeric unix timestamps.",
      },
      400,
    )
  }

  if (endTime <= startTime) {
    return jsonResponse(
      {
        error: "Query parameter 'endTime' must be greater than 'startTime'.",
      },
      400,
    )
  }

  try {
    const weatherReadings = await withDatabase((database) =>
      database.getWeatherInRange(startTime, endTime),
    )

    return jsonResponse(weatherReadings)
  } catch (err) {
    context.log("Database error in getWeatherInRange", err)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
}

app.http("getLatestWeather", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getLatestWeather,
})

app.http("getWeatherInRange", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getWeatherInRange,
})
