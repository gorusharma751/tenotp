import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/common/PageHeader";
import { Toolbar } from "@/components/admin/Toolbar";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/apiClient";
import { dateShort } from "@/utils/format";
import { toast } from "sonner";
import { Folder, ImageIcon, FolderOpen, Trash2 } from "lucide-react";
import type { MediaAsset } from "@/types";

export default function AdminMedia() {
  const q = useQuery({ queryKey: ["admin", "media"], queryFn: () => api.get<MediaAsset[]>("/api/admin/media") });
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState<string | null>(null);
  const folders = useMemo(() => Array.from(new Set((q.data ?? []).map((m) => m.folder))), [q.data]);
  const items = (q.data ?? []).filter((m) =>
    (folder === null || m.folder === folder) &&
    (query === "" || m.name.toLowerCase().includes(query.toLowerCase()))
  );
  return (
    <div>
      <PageHeader title="Media Library" description="Upload and organize logos, banners, flags, icons, and illustrations." />
      <Toolbar query={query} onQuery={setQuery} placeholder="Search assets...">
        <Button variant={folder === null ? "default" : "outline"} size="sm" onClick={() => setFolder(null)}>All</Button>
        {folders.map((f) => (
          <Button key={f} variant={folder === f ? "default" : "outline"} size="sm" onClick={() => setFolder(f)}>
            <Folder className="mr-1 h-3 w-3" />{f}
          </Button>
        ))}
      </Toolbar>
      <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((m) => (
          <Card key={m.id} className="shadow-soft group overflow-hidden">
            <div className="aspect-square grid place-items-center bg-gradient-to-br from-primary/10 to-info/10 relative">
              <ImageIcon className="h-8 w-8 text-muted-foreground" />
              <div className="absolute inset-0 hidden group-hover:flex items-end justify-end p-2 bg-black/40">
                <Button variant="ghost" size="icon" className="h-7 w-7 text-white" onClick={() => toast.error("Deleted")}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
            <CardContent className="p-2">
              <p className="text-xs font-medium truncate">{m.name}</p>
              <p className="text-[10px] text-muted-foreground">{m.size} · {dateShort(m.uploadedAt)}</p>
            </CardContent>
          </Card>
        ))}
        {items.length === 0 && <div className="col-span-full py-12 text-center text-sm text-muted-foreground flex flex-col items-center gap-2"><FolderOpen className="h-8 w-8" />No assets in this folder</div>}
      </div>
    </div>
  );
}
