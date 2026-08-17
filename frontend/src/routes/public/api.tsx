import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function ApiPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16">
      <h1 className="text-4xl font-bold">Developer API</h1>
      <p className="mt-3 text-muted-foreground max-w-2xl">Buy numbers, receive OTPs, and manage rentals programmatically. REST endpoints, webhooks, and typed SDKs for TypeScript, Python and Go.</p>
      <Card className="mt-8 shadow-soft"><CardContent className="p-6 font-mono text-xs sm:text-sm overflow-x-auto">
        <pre className="whitespace-pre">{`POST /v1/numbers
Authorization: Bearer gop_live_...
Content-Type: application/json

{
  "service": "whatsapp",
  "country": "US"
}

→ 200 OK
{
  "id": "num_01H8...",
  "number": "+1 555 8210",
  "status": "pending",
  "expires_at": "2026-07-14T12:20:00Z"
}`}</pre>
      </CardContent></Card>
      <div className="mt-8 flex gap-3">
        <Button asChild className="gradient-brand"><Link to="/register">Get an API key</Link></Button>
        <Button asChild variant="outline"><Link to={"/contact-us" as any}>Talk to sales</Link></Button>
      </div>
    </div>
  );
}
