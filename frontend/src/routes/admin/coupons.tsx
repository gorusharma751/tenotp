import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { AdminTable, StatusPill } from "@/components/admin/AdminTable";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/apiClient";
import { dateShort } from "@/utils/format";
import { toast } from "sonner";
import { Plus, Copy, Trash2, Gift } from "lucide-react";
import type { Coupon } from "@/types";

// TODO(backend): backend/src/routes/admin.ts only exposes GET /api/admin/coupons.
// There is no POST (create), PATCH (enable/disable), or DELETE endpoint for
// coupons yet, so creation, the enable switch, and delete are disabled below
// (left static / read-only) rather than calling an endpoint that doesn't exist.
function randomCode(prefix = "GIFT") {
  const s = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${s}`;
}

function CreateDialog() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"percent" | "flat" | "gift">("gift");
  const [code, setCode] = useState(randomCode("GIFT"));
  const [value, setValue] = useState("100");
  const [limit, setLimit] = useState("1");
  const [expiresAt, setExpiresAt] = useState("");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gradient-brand">
          <Plus className="mr-2 h-4 w-4" />
          New code
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create coupon or gift code</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v as "percent" | "flat" | "gift");
                setCode(randomCode(v === "gift" ? "GIFT" : "SAVE"));
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="gift">
                  🎁 Gift code — adds balance to wallet on redeem
                </SelectItem>
                <SelectItem value="percent">Percent discount (%)</SelectItem>
                <SelectItem value="flat">Flat discount (₹)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <Label>Code</Label>
              <Input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="e.g. GIFT-ABC123"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCode(randomCode(type === "gift" ? "GIFT" : "SAVE"))}
            >
              Random
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>
                {type === "percent"
                  ? "Percent (%)"
                  : type === "flat"
                    ? "Discount (₹)"
                    : "Gift amount (₹)"}
              </Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
            </div>
            <div>
              <Label>Max redemptions (0 = unlimited)</Label>
              <Input
                type="number"
                min="0"
                value={limit}
                onChange={(e) => setLimit(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Label>Expires at (optional)</Label>
            <Input
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
          </div>
          <p className="text-xs text-muted-foreground bg-muted/50 rounded p-2">
            Creating codes isn't wired up yet — the backend has no create endpoint for coupons.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button disabled title="Backend create endpoint not available yet">
            Create
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminCoupons() {
  const q = useQuery({
    queryKey: ["admin", "coupons"],
    queryFn: () => api.get<Coupon[]>("/api/admin/coupons"),
  });
  const rows = q.data ?? [];
  return (
    <div>
      <PageHeader
        title="Coupons & Gift codes"
        description="Percent/flat discount codes, plus gift codes that add balance to a user's wallet."
        actions={<CreateDialog />}
      />
      <AdminTable
        rows={rows}
        columns={[
          {
            key: "code",
            header: "Code",
            cell: (c) => (
              <span className="font-mono font-medium inline-flex items-center gap-2">
                {c.type === "gift" && <Gift className="h-3.5 w-3.5 text-primary" />}
                {c.code}
              </span>
            ),
          },
          {
            key: "t",
            header: "Type",
            cell: (c) => (
              <Badge
                variant={c.type === "gift" ? "default" : "secondary"}
                className="capitalize text-[10px]"
              >
                {c.type}
              </Badge>
            ),
          },
          {
            key: "v",
            header: "Value",
            cell: (c) => (c.type === "percent" ? `${c.value}%` : `₹${c.value}`),
          },
          {
            key: "u",
            header: "Usage",
            cell: (c) => (
              <div className="w-32">
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>{c.used}</span>
                  <span>{c.limit || "∞"}</span>
                </div>
                <Progress value={c.limit ? (c.used / c.limit) * 100 : 0} />
              </div>
            ),
          },
          {
            key: "ex",
            header: "Expires",
            cell: (c) => (
              <span className="text-xs">{c.expiresAt ? dateShort(c.expiresAt) : "—"}</span>
            ),
          },
          {
            key: "en",
            header: "Enabled",
            cell: (c) => (
              <Switch checked={c.enabled} disabled title="Not editable yet — no backend endpoint" />
            ),
          },
          {
            key: "st",
            header: "Status",
            cell: (c) => <StatusPill status={c.enabled ? "active" : "closed"} />,
          },
          {
            key: "act",
            header: "",
            cell: (c) => (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(c.code);
                    toast.success("Code copied");
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" disabled title="Backend delete endpoint not available yet">
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
