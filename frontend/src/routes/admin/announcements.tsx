import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { dateTime } from "@/utils/format";
import { toast } from "sonner";
import { Plus, Archive, Send } from "lucide-react";
import type { Announcement } from "@/types";

// No backend table for announcements yet (monolith kept this as an empty
// stub too — src/api/events.ts always returned []). Preserved as local
// stub calls so the UI/structure matches 1:1; wire to a real endpoint if
// one is added later.
const announcementsApi = {
  async list(): Promise<Announcement[]> { return []; },
  async publish(_id: string) { return { ok: true as const }; },
  async archive(_id: string) { return { ok: true as const }; },
  async create(_input: { title: string; body: string; audience: Announcement["audience"] }): Promise<Announcement | null> { return null; },
};

export default function AdminAnnouncements() {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["announcements"], queryFn: () => announcementsApi.list() });
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", body: "", audience: "all" as const });
  const invalidate = () => qc.invalidateQueries({ queryKey: ["announcements"] });

  const create = async () => {
    try { await announcementsApi.create(form); toast.success("Published"); setOpen(false); setForm({ title: "", body: "", audience: "all" }); invalidate(); }
    catch (e) { toast.error((e as Error).message); }
  };

  return (
    <div>
      <PageHeader title="Announcements" description="Publish product news, advisories and offers." actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button className="gradient-brand"><Plus className="h-4 w-4 mr-1" />New</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <Input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              <Textarea placeholder="Body" value={form.body} onChange={(e) => setForm({ ...form, body: e.target.value })} rows={4} />
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v as never })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["all","users","admins","resellers"].map((x) => <SelectItem key={x} value={x}>{x}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <DialogFooter><Button onClick={create} className="gradient-brand">Publish</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />

      {q.isLoading ? <Skeleton className="h-40" /> : (
        <div className="grid gap-3">
          {(q.data ?? []).map((a) => (
            <Card key={a.id} className="shadow-soft">
              <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{a.title}</h3>
                    <Badge variant="secondary">{a.audience}</Badge>
                    <Badge variant="outline">{a.status}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2">{a.body}</p>
                  <div className="text-xs text-muted-foreground mt-1">{dateTime(a.publishedAt)}</div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {a.status !== "published" && <Button size="sm" variant="outline" onClick={async () => { await announcementsApi.publish(a.id); invalidate(); toast.success("Published"); }}><Send className="h-4 w-4 mr-1" />Publish</Button>}
                  <Button size="sm" variant="ghost" onClick={async () => { await announcementsApi.archive(a.id); invalidate(); toast.success("Archived"); }}><Archive className="h-4 w-4 mr-1" />Archive</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
