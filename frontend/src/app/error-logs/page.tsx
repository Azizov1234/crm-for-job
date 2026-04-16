"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Filter, RefreshCcw } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { ModalShell, PageHero, SearchToolbar } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { errorLogsApi } from "@/lib/api/services";
import { formatDate } from "@/lib/utils-helpers";

type ErrorLogRow = {
  id: string;
  message: string;
  stack?: string | null;
  path?: string | null;
  method?: string | null;
  statusCode?: number | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  meta?: unknown;
  createdAt: string;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    role?: string;
  } | null;
  branch?: {
    id: string;
    name: string;
  } | null;
};

type ErrorLogDetails = ErrorLogRow;

const METHOD_OPTIONS = ["ALL", "GET", "POST", "PATCH", "PUT", "DELETE"];

function statusBadgeClass(statusCode?: number | null) {
  if (!statusCode) return "bg-[#eef2ff] text-[#4f5ed9]";
  if (statusCode >= 500) return "bg-[#ffe9ee] text-[#c03b57]";
  if (statusCode >= 400) return "bg-[#fff1de] text-[#ba6c08]";
  return "bg-[#eaf8f3] text-[#0c8a5e]";
}

export default function ErrorLogsPage() {
  const [logs, setLogs] = useState<ErrorLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("ALL");
  const [statusCode, setStatusCode] = useState("");
  const [selectedLog, setSelectedLog] = useState<ErrorLogDetails | null>(null);
  const [openDetails, setOpenDetails] = useState(false);

  async function loadLogs() {
    try {
      setLoading(true);
      const response = await errorLogsApi.list({
        page: 1,
        limit: 100,
        search: search || undefined,
        method: method === "ALL" ? undefined : method,
        statusCode: statusCode.trim() ? Number(statusCode) : undefined,
      });
      setLogs((response.data as ErrorLogRow[]) ?? []);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Error loglar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadLogs();
  }, [search, method, statusCode]);

  async function openLogDetails(id: string) {
    try {
      const data = (await errorLogsApi.getById(id)) as ErrorLogDetails;
      setSelectedLog(data);
      setOpenDetails(true);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Error log detail olinmadi");
    }
  }

  return (
    <DashboardLayout title="Error loglar" description="Xatolarni tez ko'rish va diagnostika paneli">
      <PageHero
        title="Error loglar"
        subtitle="API xatolarini status, method va stack bilan kuzating"
        icon={AlertTriangle}
        statLabel="Jami loglar"
        statValue={logs.length}
      />

      <SearchToolbar
        value={search}
        onChange={setSearch}
        placeholder="Message yoki path bo'yicha qidiring..."
        actions={
          <>
            <Select value={method} onValueChange={(value) => setMethod(value ?? "ALL")}>
              <SelectTrigger className="h-11 rounded-xl border-[#e3e8f4] bg-white">
                <SelectValue placeholder="Method" />
              </SelectTrigger>
              <SelectContent>
                {METHOD_OPTIONS.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item === "ALL" ? "Barcha method" : item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="soft-input h-11 w-36"
              placeholder="Status kod"
              value={statusCode}
              onChange={(event) => setStatusCode(event.target.value)}
            />
            <Button
              variant="outline"
              className="h-11 rounded-xl border-[#e3e8f4] bg-white"
              onClick={loadLogs}
              disabled={loading}
            >
              <Filter className="mr-1 h-4 w-4" />
              Filter
            </Button>
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

      <section className="panel-surface overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[#f6f8fe] text-xs uppercase tracking-[0.11em] text-[#8e98b7]">
              <tr>
                <th className="px-4 py-3 text-left">Vaqt</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Method / Path</th>
                <th className="px-4 py-3 text-left">Xabar</th>
                <th className="px-4 py-3 text-left">User</th>
                <th className="px-4 py-3 text-left">Branch</th>
                <th className="px-4 py-3 text-right">Amal</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#edf1fb] bg-white">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-3 text-[#616b8e]">{formatDate(log.createdAt)}</td>
                  <td className="px-4 py-3">
                    <Badge className={statusBadgeClass(log.statusCode)}>
                      {log.statusCode ?? "-"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-[#2f3655]">{log.method ?? "-"}</p>
                    <p className="max-w-[280px] truncate text-xs text-[#8b95b3]">
                      {log.path ?? "-"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="max-w-[340px] truncate text-[#2f3655]">{log.message}</p>
                  </td>
                  <td className="px-4 py-3 text-[#616b8e]">
                    {log.user
                      ? `${log.user.firstName ?? ""} ${log.user.lastName ?? ""}`.trim() ||
                        log.user.id
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-[#616b8e]">{log.branch?.name ?? "-"}</td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="outline"
                      className="h-9 rounded-lg border-[#dce3f5]"
                      onClick={() => void openLogDetails(log.id)}
                    >
                      Batafsil
                    </Button>
                  </td>
                </tr>
              ))}
              {!logs.length ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-[#8b95b3]">
                    Error loglar topilmadi
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      <ModalShell
        open={openDetails}
        onClose={() => setOpenDetails(false)}
        title="Error log tafsiloti"
        subtitle="Xatolik diagnostikasi"
      >
        {selectedLog ? (
          <div className="space-y-3">
            <DetailRow label="Message" value={selectedLog.message} />
            <DetailRow label="Status" value={String(selectedLog.statusCode ?? "-")} />
            <DetailRow label="Method" value={selectedLog.method ?? "-"} />
            <DetailRow label="Path" value={selectedLog.path ?? "-"} />
            <DetailRow label="IP" value={selectedLog.ipAddress ?? "-"} />
            <DetailRow label="User Agent" value={selectedLog.userAgent ?? "-"} />
            <DetailRow
              label="User"
              value={
                selectedLog.user
                  ? `${selectedLog.user.firstName ?? ""} ${selectedLog.user.lastName ?? ""}`.trim() ||
                    selectedLog.user.id
                  : "-"
              }
            />
            <DetailRow label="Branch" value={selectedLog.branch?.name ?? "-"} />
            {selectedLog.stack ? (
              <DetailBlock label="Stack" value={selectedLog.stack} />
            ) : null}
            {selectedLog.meta ? (
              <DetailBlock label="Meta" value={JSON.stringify(selectedLog.meta, null, 2)} />
            ) : null}
          </div>
        ) : null}
      </ModalShell>
    </DashboardLayout>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#edf1fb] bg-[#fbfcff] px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[#8b95b3]">{label}</p>
      <p className="mt-1 text-sm text-[#2f3655]">{value}</p>
    </div>
  );
}

function DetailBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[#edf1fb] bg-[#fbfcff] px-3 py-2">
      <p className="text-xs font-semibold uppercase tracking-[0.11em] text-[#8b95b3]">{label}</p>
      <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap break-all text-xs text-[#2f3655]">
        {value}
      </pre>
    </div>
  );
}
