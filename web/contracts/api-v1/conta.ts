import { z } from "zod"
import { ApiScope, UtcInstant, Uuid } from "./comum"

/** GET /me */
export const Me = z.object({
  organization: z.object({ id: Uuid, name: z.string(), slug: z.string(), niche: z.string().nullable() }),
  api_key: z.object({
    id: Uuid,
    name: z.string(),
    key_prefix: z.string(),
    scopes: z.array(ApiScope),
    created_at: UtcInstant,
    expires_at: UtcInstant.nullable(),
  }),
})

/** GET /logs */
export const LogsQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(200).default(50),
    offset: z.coerce.number().int().min(0).default(0),
    scope: z.enum(["key", "organization"]).default("key"),
  })
  .strict()

export const RequestLog = z.object({
  id: Uuid,
  key_prefix: z.string(),
  request_id: z.string(),
  method: z.string(),
  path: z.string(),
  status_code: z.number().int(),
  error_code: z.string().nullable(),
  duration_ms: z.number().int().nullable(),
  ip: z.string().nullable(),
  user_agent: z.string().nullable(),
  created_at: UtcInstant,
})
