const ALLOWED_ORIGINS = [
  "https://sawwiq.com",
  "https://www.sawwiq.com",
  "http://localhost:3000",
  "http://localhost:3001",
];

function getAllowedOrigin(reqOrigin: string | null): string {
  if (reqOrigin && ALLOWED_ORIGINS.includes(reqOrigin)) {
    return reqOrigin;
  }
  return ALLOWED_ORIGINS[0];
}

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = getAllowedOrigin(req.headers.get("origin"));
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-session-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

export function corsResponse(body: string, status = 200, req?: Request): Response {
  const corsHeaders = req ? getCorsHeaders(req) : {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS[0],
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-session-token",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  return new Response(body, {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
