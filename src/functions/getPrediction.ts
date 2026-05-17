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

function getModelName(request: HttpRequest): "DMI" | "VIA" {
  const modelName = request.query.get("modelName")

  if (modelName === "VIA") {
    return "VIA"
  }

  return "DMI"
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

export async function getPredictionsNextHours(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const hoursFromNow = Number(request.query.get("hoursFromNow"))
  const modelName = getModelName(request)

  if (!Number.isFinite(hoursFromNow) || hoursFromNow <= 0) {
    return jsonResponse(
      {
        error:
          "Query parameter 'hoursFromNow' is required and must be a positive finite number.",
      },
      400,
    )
  }

  const MAX_HOURS = 7 * 24

  if (hoursFromNow > MAX_HOURS) {
    return jsonResponse(
      {
        error: `Query parameter 'hoursFromNow' must not exceed ${MAX_HOURS} (7 days).`,
      },
      400,
    )
  }

  try {
    const predictions = await withDatabase((database) =>
      database.getPredictionsNextHours(hoursFromNow, modelName),
    )

    return jsonResponse(predictions)
  } catch (err) {
    context.log("Database error in getPredictionsNextHours", err)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
}

export async function getPredictionsInRange(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const startTime = Number(request.query.get("startTime"))
  const endTime = Number(request.query.get("endTime"))
  const modelName = getModelName(request)

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
    const predictions = await withDatabase((database) =>
      database.getPredictionsInRange(startTime, endTime, modelName),
    )

    return jsonResponse(predictions)
  } catch (err) {
    context.log("Database error in getPredictionsInRange", err)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
}

export async function getPredictionNext24Hours(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const modelName = getModelName(request)

  try {
    const prediction = await withDatabase((database) =>
      database.getPredictionClosestToNext24Hours(modelName),
    )

    if (!prediction) {
      return jsonResponse(
        { error: "No prediction available within the next 24 hours." },
        404,
      )
    }

    return jsonResponse(prediction)
  } catch (err) {
    context.log("Database error in getPredictionNext24Hours", err)
    return jsonResponse({ error: "Internal server error" }, 500)
  }
}

app.http("getPredictionsNextHours", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getPredictionsNextHours,
})

app.http("getPredictionsInRange", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getPredictionsInRange,
})

app.http("getPredictionNext24Hours", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getPredictionNext24Hours,
})