"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { Activity, Eye, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmptyState, ModalShell, PageHero, SearchToolbar } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { actionLogsApi } from "@/lib/api/services";
import { Status } from "@/lib/types";
import { formatDate } from "@/lib/utils-helpers";

const ACTION_TYPES = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "LOGIN",
  "LOGOUT",
  "PAYMENT",
  "ATTENDANCE_MARK",
  "ROLE_UPDATE",
] as const;

const STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"];

type ActionLogRow = {
  id: string;
  actionType: string;
  entityType: string;
  entityId: string | null;
  description: string;
  status: Status;
  createdAt: string;
  user?: {
    id?: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  } | null;
  branch?: {
    id?: string;
    name?: string;
  } | null;
  oldData?: unknown;
  newData?: unknown;
};

function getUserLabel(row: ActionLogRow) {
  const firstName = row.user?.firstName ?? "";
  const lastName = row.user?.lastName ?? "";
  const fullName = `${firstName} ${lastName}`.trim();
  return fullName || row.user?.id || "-";
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function mapActionLogRow(value: unknown): ActionLogRow {
  const row = toRecord(value);
  return {
    id: typeof row.id === "string" ? row.id : "",
    actionType: typeof row.actionType === "string" ? row.actionType : "-",
    entityType: typeof row.entityType === "string" ? row.entityType : "-",
    entityId: typeof row.entityId === "string" ? row.entityId : null,
    description: typeof row.description === "string" ? row.description : "-",
    status: (typeof row.status === "string" ? row.status : "ACTIVE") as Status,
    createdAt: typeof row.createdAt === "string" ? row.createdAt : "",
    user: (row.user as ActionLogRow["user"]) ?? null,
    branch: (row.branch as ActionLogRow["branch"]) ?? null,
    oldData: row.oldData,
    newData: row.newData,
  };
}

export default function ActionLogsPage() {
  const [rows, setRows] = useState<ActionLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ALL");
  const [entityType, setEntityType] = useState("");
  const [selectedLog, setSelectedLog] = useState<ActionLogRow | null>(null);

  const stats = useMemo(() => {
    return {
      total: rows.length,
      create: rows.filter((item) => item.actionType === "CREATE").length,
      update: rows.filter((item) => item.actionType === "UPDATE").length,
      delete: rows.filter((item) => item.actionType === "DELETE").length,
    };
  }, [rows]);

  async function loadLogs() {
    try {
      setLoading(true);
      const response = await actionLogsApi.list({
        page: 1,
        limit: 100,
        search: search || undefined,
        actionType: actionType === "ALL" ? undefined : actionType,
        status: status === "ALL" ? undefined : status,
        entityType: entityType.trim() || undefined,
      });

      setRows(((response.data as unknown[]) ?? []).map(mapActionLogRow));
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Action loglarni yuklashda xatolik",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionType, status]);

  return (
    <DashboardLayout title="Action loglar" description="Amallar tarixini kuzatish paneli">
      <PageHero
        title="Action loglar"
        subtitle="Kim qachon qanday amal qilganini tekshirish"
        icon={Activity}
        statLabel="Jami yozuvlar"
        statValue={stats.total}
      />

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Create" value={stats.create} />
        <StatCard label="Update" value={stats.update} />
        <StatCard label="Delete" value={stats.delete} />
        <StatCard label="Umumiy" value={stats.total} />
      </section>

      <SearchToolbar
        value={search}
        onChange={setSearch}
        onFilter={loadLogs}
        placeholder="Action loglardan qidiring..."
        actions={
          <>
            <Input
              className="h-11 min-w-[150px] rounded-xl border-[#e3e8f4] bg-white"
              value={entityType}
              onChange={(event) => setEntityType(event.target.value)}
              placeholder="Entity type"
            />
            <Select value={actionType} onValueChange={(value) => setActionType(value ?? "ALL")}>
              <SelectTrigger className="h-11 min-w-[170px] rounded-xl border-[#e3e8f4] bg-white">
                <SelectValue placeholder="Action type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Barcha action</SelectItem>
                {ACTION_TYPES.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(value) => setStatus(value ?? "ALL")}>
              <SelectTrigger className="h-11 min-w-[150px] rounded-xl border-[#e3e8f4] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Barcha status</SelectItem>
                {STATUS_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              className="h-11 rounded-xl border-[#e3e8f4] bg-white"
              onClick={loadLogs}
              disabled={loading}
            >
              <RefreshCcw className="mr-1 h-4 w-4" />
              Yangilash
            </Button>
          </>
        }
      />

      {!rows.length ? (
        <EmptyState
          title="Action loglar topilmadi"
          subtitle="Filterlarni tekshirib qayta urinib ko'ring."
        />
      ) : (
        <section className="panel-surface overflow-hidden">
          <div className="grid grid-cols-[0.9fr_0.8fr_0.9fr_1.2fr_1fr_0.8fr_0.5fr] gap-3 border-b border-[#edf1fb] bg-[#f6f8fe] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f99b7]">
            <span>Vaqt</span>
            <span>Action</span>
            <span>Entity</span>
            <span>Tavsif</span>
            <span>Foydalanuvchi</span>
            <span>Status</span>
            <span className="text-right">Ko'rish</span>
          </div>
          <div className="divide-y divide-[#edf1fb]">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[0.9fr_0.8fr_0.9fr_1.2fr_1fr_0.8fr_0.5fr] items-center gap-3 px-4 py-3 text-sm"
              >
                <span className="text-[#616b8e]">{formatDate(row.createdAt)}</span>
                <Badge variant="outline" className="justify-center">{row.actionType}</Badge>
                <span className="text-[#2f3655]">
                  {row.entityType}
                  {row.entityId ? <span className="ml-1 text-xs text-[#8e98b7]">#{row.entityId.slice(0, 8)}</span> : null}
                </span>
                <span className="truncate text-[#616b8e]" title={row.description}>{row.description}</span>
                <span className="text-[#2f3655]">
                  {getUserLabel(row)}
                  {row.branch?.name ? <span className="ml-1 text-xs text-[#8e98b7]">({row.branch.name})</span> : null}
                </span>
                <Badge variant={row.status === "ACTIVE" ? "secondary" : "outline"}>{row.status}</Badge>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#4458cc] hover:bg-[#eef2ff]"
                    onClick={() => setSelectedLog(row)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ModalShell
        open={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Action log tafsiloti"
        subtitle={selectedLog ? `${selectedLog.actionType} - ${selectedLog.entityType}` : ""}
      >
        {selectedLog ? (
          <div className="space-y-3">
            <div className="rounded-xl border border-[#e8edf8] bg-[#fbfcff] p-3 text-sm text-[#4c5679]">
              <p><strong>ID:</strong> {selectedLog.id}</p>
              <p><strong>Vaqt:</strong> {formatDate(selectedLog.createdAt)}</p>
              <p><strong>Tavsif:</strong> {selectedLog.description}</p>
            </div>
            <div className="rounded-xl border border-[#e8edf8] bg-[#fbfcff] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f99b7]">Old Data</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs text-[#5f6888]">
                {JSON.stringify(selectedLog.oldData ?? null, null, 2)}
              </pre>
            </div>
            <div className="rounded-xl border border-[#e8edf8] bg-[#fbfcff] p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f99b7]">New Data</p>
              <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all text-xs text-[#5f6888]">
                {JSON.stringify(selectedLog.newData ?? null, null, 2)}
              </pre>
            </div>
          </div>
        ) : null}
      </ModalShell>
    </DashboardLayout>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-[#dde4f6] bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#8f99b7]">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-[#2f3655]">{value}</p>
    </article>
  );
}
