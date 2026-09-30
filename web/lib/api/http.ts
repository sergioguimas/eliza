import { NextResponse } from "next/server"

export type ApiErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "ORGANIZATION_SUSPENDED"
  | "RATE_LIMITED"
  | "INVALID_JSON"
  | "VALIDATION_ERROR"
  | "NOT_FOUND"
  | "CONFLICT"
  | "SLOT_UNAVAILABLE"
  | "INVALID_TRANSITION"
  | "INTERNAL_ERROR"

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: ApiErrorCode,
    message: string,
    public details?: unknown,
    public headers?: Record<string, string>
  ) {
    super(message)
  }
}

export const notFound = (what: string) =>
  new ApiError(404, "NOT_FOUND", `${what} não encontrado(a).`)

export const validation = (message: string, details?: unknown) =>
  new ApiError(422, "VALIDATION_ERROR", message, details)

export function jsonResponse(
  body: unknown,
  status: number,
  requestId: string,
  headers?: Record<string, string>
) {
  return NextResponse.json(body, {
    status,
    headers: {
      "X-Request-Id": requestId,
      "Cache-Control": "no-store",
      ...headers,
    },
  })
}
