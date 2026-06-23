import { headers } from "next/headers"

function normalizeUrl(url: string) {
  return url.replace(/\/$/, "")
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

export async function getAppUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL

  if (configuredUrl && isHttpUrl(configuredUrl)) {
    return normalizeUrl(configuredUrl)
  }

  const requestHeaders = await headers()
  const origin = requestHeaders.get("origin")

  if (origin && isHttpUrl(origin)) {
    return normalizeUrl(origin)
  }

  const forwardedHost = requestHeaders
    .get("x-forwarded-host")
    ?.split(",")[0]
    .trim()
  const host = forwardedHost || requestHeaders.get("host")

  if (host) {
    const forwardedProtocol = requestHeaders
      .get("x-forwarded-proto")
      ?.split(",")[0]
      .trim()
    const protocol =
      forwardedProtocol === "http" || forwardedProtocol === "https"
        ? forwardedProtocol
        : host.startsWith("localhost") || host.startsWith("127.0.0.1")
          ? "http"
          : "https"

    return `${protocol}://${host}`
  }

  return "http://localhost:3000"
}
