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

export async function getPredictionsNext24Hours(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const predictions = await withDatabase((database) =>
    database.getPredictionsNext24Hours(),
  )

  return jsonResponse(predictions)
}

export async function getPredictionsNext7Days(
  request: HttpRequest,
  context: InvocationContext,
): Promise<HttpResponseInit> {
  context.log(`Http function processed request for url "${request.url}"`)

  const predictions = await withDatabase((database) =>
    database.getPredictionsNext7Days(),
  )

  return jsonResponse(predictions)
}

export async function getPredictionsInRange(
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

  const predictions = await withDatabase((database) =>
    database.getPredictionsInRange(startTime, endTime),
  )

  return jsonResponse(predictions)
}

app.http("getPredictionsNext24Hours", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getPredictionsNext24Hours,
})

app.http("getPredictionsNext7Days", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getPredictionsNext7Days,
})

app.http("getPredictionsInRange", {
  methods: ["GET"],
  authLevel: "anonymous",
  handler: getPredictionsInRange,
})
