import { describe, it, expect } from "vitest"
import Database from "../src/database"

type QueryCall = {
  sql: string
  params: unknown[]
}

function createMockDb(rows: unknown[] = []) {
  const calls: QueryCall[] = []

  const client = {
    query: async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params: params ?? [] })
      return { rows }
    },
    release: () => {},
  }

  const db = new Database(client as never)

  return { db, calls }
}

describe("Database prediction queries", () => {
  it("builds 15-minute buckets for next 24 hours", async () => {
    const { db, calls } = createMockDb([])

    await db.getPredictionsNext24Hours("VIA")

    const { sql, params } = calls[0]

    expect(params).toEqual(["VIA"])
    expect(sql).toContain(
      "ROUND(wp.predicted_time / 900.0) * 900 AS bucket_epoch",
    )
    expect(sql).toContain("ROW_NUMBER() OVER")
    expect(sql).toContain("wp.prediction_offset ASC")
    expect(sql).toContain(
      "ABS(wp.predicted_time - (ROUND(wp.predicted_time / 900.0) * 900)) ASC",
    )
    expect(sql).toContain("wp.predicted_time >= EXTRACT(EPOCH FROM NOW())")
    expect(sql).toContain(
      "wp.predicted_time < EXTRACT(EPOCH FROM NOW()) + 24 * 3600",
    )
  })

  it("uses horizon-based buckets for next hours", async () => {
    const { db, calls } = createMockDb([])

    await db.getPredictionsNextHours(6)

    const { sql, params } = calls[0]

    expect(params).toEqual([6, "DMI"])
    expect(sql).toContain(
      "WHEN wp.predicted_time < p.now_epoch + 24 * 3600 THEN 900",
    )
    expect(sql).toContain(
      "WHEN wp.predicted_time < p.now_epoch + 48 * 3600 THEN 7200",
    )
    expect(sql).toContain(
      "WHEN wp.predicted_time < p.now_epoch + 96 * 3600 THEN 10800",
    )
    expect(sql).toContain("ELSE 21600")
    expect(sql).toContain(
      "(ROUND(predicted_time::numeric / bucket_seconds) * bucket_seconds)::bigint AS bucket_epoch",
    )
    expect(sql).toContain("p.now_epoch + $1 * 3600")
  })

  it("prefers offset 24+ for past in last/next 24 hours", async () => {
    const { db, calls } = createMockDb([])

    await db.getPredictionsLastAndNext24Hours()

    const { sql } = calls[0]

    expect(sql).toContain(
      "CASE WHEN wp.prediction_offset >= 24 THEN 0 ELSE 1 END",
    )
    expect(sql).toContain("ELSE -wp.prediction_offset")
    expect(sql).toContain("EXTRACT(EPOCH FROM NOW() - INTERVAL '24 hours')")
    expect(sql).toContain(
      "ROUND(wp.predicted_time / 900.0) * 900 AS bucket_epoch",
    )
    expect(sql).toContain("UNION ALL")
  })

  it("targets the next-24-hour hour window when choosing the closest", async () => {
    const { db, calls } = createMockDb([])

    await db.getPredictionClosestToNext24Hours()

    const { sql } = calls[0]

    expect(sql).toContain(
      "date_trunc('hour', NOW() + INTERVAL '24 hours') AS target_hour_start",
    )
    expect(sql).toContain(
      "date_trunc('hour', NOW() + INTERVAL '24 hours') + INTERVAL '1 hour' AS target_hour_end",
    )
    expect(sql).toContain("FROM preferred")
    expect(sql).toContain("FROM fallback")
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM preferred)")
  })

  it("uses horizon-based buckets for ranged predictions", async () => {
    const { db, calls } = createMockDb([])

    await db.getPredictionsInRange(100, 200, "VIA")

    const { sql, params } = calls[0]

    expect(params).toEqual([100, 200, "VIA"])
    expect(sql).toContain("WHEN wp.predicted_time < p.now_epoch THEN 900")
    expect(sql).toContain(
      "WHEN wp.predicted_time < p.now_epoch + 24 * 3600 THEN 900",
    )
    expect(sql).toContain("ELSE 21600")
    expect(sql).toContain(
      "(ROUND(predicted_time::numeric / bucket_seconds) * bucket_seconds)::bigint AS bucket_epoch",
    )
  })

  it("returns null when the closest query returns no rows", async () => {
    const { db } = createMockDb([])

    const result = await db.getPredictionClosestToNext24Hours()

    expect(result).toBeNull()
  })

  it("returns the first row from the closest query", async () => {
    const expected = { predictedTime: 123 }
    const { db } = createMockDb([expected])

    const result = await db.getPredictionClosestToNext24Hours()

    expect(result).toEqual(expected)
  })

  it("validates hoursFromNow bounds", async () => {
    const { db } = createMockDb([])

    await expect(db.getPredictionsNextHours(0)).rejects.toThrow(
      "hoursFromNow must be a positive finite number",
    )
    await expect(db.getPredictionsNextHours(Infinity)).rejects.toThrow(
      "hoursFromNow must be a positive finite number",
    )
    await expect(db.getPredictionsNextHours(999)).rejects.toThrow(
      "hoursFromNow must not exceed 168 (7 days)",
    )
  })
})
