import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { toast } from "sonner";
import { MessageCircle, LifeBuoy, CreditCard, KeyRound, Send, Inbox } from "lucide-react";

const CATS = [
  { id: "otp", label: "OTP issues", icon: Inbox },
  { id: "billing", label: "Billing & wallet", icon: CreditCard },
  { id: "api", label: "API & keys", icon: KeyRound },
  { id: "other", label: "General", icon: LifeBuoy },
];

// TODO(backend): no /api/support/tickets create endpoint is ported yet —
// submit just confirms locally, same shape as the monolith otherwise.
export default function Support() {
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("otp");
  const [body, setBody] = useState("");
  const submit = () => {
    toast.success("Ticket created");
    setSubject("");
    setBody("");
  };
  return (
    <div>
      <PageHeader title="Support" description="Reach the TenOTP team — 24×7 response." actions={
        <Button asChild variant="outline"><Link to="/dashboard/tickets">Ticket history</Link></Button>
      } />

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4 mb-6">
        {CATS.map((c) => (
          <Card key={c.id} className="shadow-soft hover:shadow-glow transition-shadow cursor-pointer" onClick={() => setCategory(c.id)}>
            <CardContent className="p-5">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary"><c.icon className="h-5 w-5" /></div>
              <p className="mt-3 font-medium">{c.label}</p>
              <p className="text-xs text-muted-foreground">Get help fast</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="shadow-soft"><CardHeader><CardTitle>Create ticket</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
                <SelectContent>{CATS.map((c) => <SelectItem key={c.id} value={c.id}>{c.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Subject</Label><Input className="mt-2" value={subject} onChange={(e) => setSubject(e.target.value)} /></div>
            <div><Label>Message</Label><Textarea className="mt-2" rows={5} value={body} onChange={(e) => setBody(e.target.value)} /></div>
            <Button className="gradient-brand" onClick={submit} disabled={!subject || !body}><Send className="h-4 w-4 mr-1" />Submit</Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="shadow-soft"><CardHeader><CardTitle className="flex items-center gap-2"><MessageCircle className="h-4 w-4" /> Live chat</CardTitle></CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              <p>Chat with support agents 24×7. Median first response: 2 minutes.</p>
              <div className="mt-3 flex gap-2">
                <Button className="gradient-brand" onClick={() => toast("Opening chat…")}>Start chat</Button>
                <Button variant="outline" onClick={() => toast("Opening Telegram…")}>Telegram</Button>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-soft"><CardHeader><CardTitle>FAQ</CardTitle></CardHeader>
            <CardContent>
              <Accordion type="single" collapsible>
                {[
                  { q: "Why didn't I receive an OTP?", a: "Try refreshing the inbox; if it never arrives you'll be auto-refunded." },
                  { q: "How do I deposit funds?", a: "Go to Wallet → Deposit and choose your preferred method." },
                  { q: "Can I export invoices?", a: "Yes — Downloads has all invoices and receipts." },
                ].map((f, i) => (
                  <AccordionItem key={i} value={`f${i}`}><AccordionTrigger>{f.q}</AccordionTrigger><AccordionContent>{f.a}</AccordionContent></AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
