import { useState } from "react";
import { PageHeader } from "@/components/common/PageHeader";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useUserStore } from "@/store/userStore";
import { Upload, Save } from "lucide-react";
import { toast } from "sonner";

// TODO(backend): no profile-update endpoint is ported yet — form is local
// only, mirrors the monolith's placeholder "Profile saved" toast behavior.
export default function Profile() {
  const user = useUserStore((s) => s.user);
  const [form, setForm] = useState({ name: user?.name ?? "", email: user?.email ?? "", phone: "", country: "US", timezone: "UTC", language: "en" });
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div>
      <PageHeader title="Profile" description="Personal information and preferences." />
      <Card className="shadow-soft mb-6 overflow-hidden">
        <div className="h-32 gradient-brand" />
        <CardContent className="p-6 -mt-14">
          <div className="flex flex-wrap items-end gap-4">
            <Avatar className="h-24 w-24 border-4 border-background shadow-soft">
              <AvatarFallback className="text-2xl">{form.name[0]?.toUpperCase() ?? "U"}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-lg font-semibold">{form.name || "Your name"}</p>
              <p className="text-sm text-muted-foreground truncate">{form.email}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => toast("Avatar upload placeholder")}><Upload className="h-4 w-4 mr-1" />Upload avatar</Button>
              <Button variant="outline" onClick={() => toast("Banner upload placeholder")}><Upload className="h-4 w-4 mr-1" />Banner</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-soft"><CardContent className="p-6 grid gap-4 sm:grid-cols-2">
        <div><Label>Name</Label><Input className="mt-2" value={form.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div><Label>Email</Label><Input className="mt-2" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div><Label>Phone</Label><Input className="mt-2" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+1 555 0000" /></div>
        <div><Label>Country</Label>
          <Select value={form.country} onValueChange={(v) => set("country", v)}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>{["US", "IN", "GB", "DE", "FR", "BR", "ID", "MX"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Timezone</Label>
          <Select value={form.timezone} onValueChange={(v) => set("timezone", v)}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent>{["UTC", "America/New_York", "Europe/London", "Asia/Kolkata", "Asia/Tokyo"].map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Language</Label>
          <Select value={form.language} onValueChange={(v) => set("language", v)}>
            <SelectTrigger className="mt-2"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="es">Español</SelectItem><SelectItem value="fr">Français</SelectItem><SelectItem value="hi">हिन्दी</SelectItem></SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2 flex gap-2 justify-end pt-2 border-t mt-2">
          <Button variant="outline" onClick={() => toast("Reverted")}>Cancel</Button>
          <Button className="gradient-brand" onClick={() => toast.success("Profile saved")}><Save className="h-4 w-4 mr-1" />Save</Button>
        </div>
      </CardContent></Card>
    </div>
  );
}
