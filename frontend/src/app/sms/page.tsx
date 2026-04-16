"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useState } from "react";
import { MessageSquareText, Plus, Send } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { GradientButton, PageHero } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { smsApi, usersApi } from "@/lib/api/services";
import { formatDate } from "@/lib/utils-helpers";

type SmsLog = {
  id: string;
  recipientPhone: string;
  message: string;
  provider?: string | null;
  smsStatus: string;
  errorMessage?: string | null;
  createdAt: string;
};

type SmsTemplate = {
  id: string;
  name: string;
  body: string;
  createdAt: string;
};

type StaffOption = {
  id: string;
  name: string;
};

const RECIPIENT_ROLE_OPTIONS = [
  "STUDENT",
  "PARENT",
  "STAFF",
  "TEACHER",
  "ADMIN",
  "SUPER_ADMIN",
];

export default function SmsPage() {
  const [logs, setLogs] = useState<SmsLog[]>([]);
  const [templates, setTemplates] = useState<SmsTemplate[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [singleDraft, setSingleDraft] = useState({
    recipientPhone: "",
    message: "",
    provider: "",
  });
  const [bulkDraft, setBulkDraft] = useState({
    recipientsText: "",
    message: "",
    provider: "",
  });
  const [templateDraft, setTemplateDraft] = useState({
    name: "",
    body: "",
  });
  const [roleNotificationDraft, setRoleNotificationDraft] = useState({
    role: "STUDENT",
    message: "",
    provider: "",
  });
  const [dueReminderDraft, setDueReminderDraft] = useState({
    daysAhead: "3",
    provider: "",
  });
  const [staffSalaryDraft, setStaffSalaryDraft] = useState({
    staffUserId: "",
    amount: "",
    month: "",
    year: "",
    note: "",
  });

  async function loadData() {
    try {
      setLoading(true);
      const [logsRes, templatesRes] = await Promise.all([
        smsApi.logs({
          page: 1,
          limit: 100,
          search: search || undefined,
        }),
        smsApi.templates.list({ page: 1, limit: 100 }),
      ]);
      setLogs((logsRes.data as SmsLog[]) ?? []);
      setTemplates((templatesRes.data as SmsTemplate[]) ?? []);
      const staffUsers = await usersApi.list({
        page: 1,
        limit: 100,
        role: "STAFF",
        status: "ACTIVE",
      });
      setStaffOptions(
        staffUsers.data.map((item) => ({
          id: item.id,
          name: item.name,
        })),
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "SMS ma'lumotlari yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [search]);

  async function sendSingle() {
    if (!singleDraft.recipientPhone.trim() || !singleDraft.message.trim()) {
      toast.error("Telefon va xabar matni majburiy");
      return;
    }
    try {
      await smsApi.send({
        recipientPhone: singleDraft.recipientPhone.trim(),
        message: singleDraft.message.trim(),
        provider: singleDraft.provider.trim() || undefined,
      });
      toast.success("SMS yuborildi");
      setSingleDraft({ recipientPhone: "", message: "", provider: "" });
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "SMS yuborilmadi");
    }
  }

  async function sendBulk() {
    const recipients = bulkDraft.recipientsText
      .split(/[,\n;]/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (!recipients.length || !bulkDraft.message.trim()) {
      toast.error("Qabul qiluvchilar va xabar matni majburiy");
      return;
    }
    try {
      await smsApi.bulkSend({
        recipients,
        message: bulkDraft.message.trim(),
        provider: bulkDraft.provider.trim() || undefined,
      });
      toast.success("Bulk SMS yuborildi");
      setBulkDraft({ recipientsText: "", message: "", provider: "" });
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Bulk SMS yuborilmadi");
    }
  }

  async function createTemplate() {
    if (!templateDraft.name.trim() || !templateDraft.body.trim()) {
      toast.error("Template nomi va matni majburiy");
      return;
    }
    try {
      await smsApi.templates.create({
        name: templateDraft.name.trim(),
        body: templateDraft.body.trim(),
      });
      toast.success("Template yaratildi");
      setTemplateDraft({ name: "", body: "" });
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Template yaratilmadi");
    }
  }

  async function sendRoleNotification() {
    if (!roleNotificationDraft.message.trim()) {
      toast.error("Notification matni majburiy");
      return;
    }

    try {
      await smsApi.notifyRoles({
        roles: [roleNotificationDraft.role],
        message: roleNotificationDraft.message.trim(),
        provider: roleNotificationDraft.provider.trim() || undefined,
      });
      toast.success("Role bo'yicha notification yuborildi");
      setRoleNotificationDraft((prev) => ({
        ...prev,
        message: "",
      }));
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Notification yuborilmadi");
    }
  }

  async function sendDuePaymentReminders() {
    const daysAhead = Number(dueReminderDraft.daysAhead);
    if (!Number.isFinite(daysAhead) || daysAhead < 1 || daysAhead > 30) {
      toast.error("Kun oralig'i 1-30 oralig'ida bo'lishi kerak");
      return;
    }

    try {
      await smsApi.notifyDuePayments({
        daysAhead,
        provider: dueReminderDraft.provider.trim() || undefined,
      });
      toast.success("To'lov muddati bo'yicha reminder yuborildi");
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Reminder yuborilmadi");
    }
  }

  async function sendStaffSalaryNotification() {
    const amount = Number(staffSalaryDraft.amount);
    if (!staffSalaryDraft.staffUserId || !Number.isFinite(amount) || amount <= 0) {
      toast.error("Xodim va to'lov summasi majburiy");
      return;
    }

    try {
      await smsApi.notifyStaffSalary({
        staffUserId: staffSalaryDraft.staffUserId,
        amount,
        month: staffSalaryDraft.month ? Number(staffSalaryDraft.month) : undefined,
        year: staffSalaryDraft.year ? Number(staffSalaryDraft.year) : undefined,
        note: staffSalaryDraft.note.trim() || undefined,
      });
      toast.success("Xodim oylik notification yuborildi");
      setStaffSalaryDraft({
        staffUserId: "",
        amount: "",
        month: "",
        year: "",
        note: "",
      });
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Xodim notification yuborilmadi");
    }
  }

  return (
    <DashboardLayout title="SMS" description="SMS yuborish, template va loglar boshqaruvi">
      <PageHero
        title="SMS"
        subtitle="Single va bulk xabarlar yuborish, template va loglarni nazorat qilish"
        icon={MessageSquareText}
        statLabel="Jami loglar"
        statValue={logs.length}
      />

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="panel-surface p-4">
          <h3 className="mb-3 text-base font-semibold text-[#2f3655]">Bitta SMS yuborish</h3>
          <div className="space-y-3">
            <Input
              className="soft-input h-11"
              placeholder="+998901234567"
              value={singleDraft.recipientPhone}
              onChange={(event) =>
                setSingleDraft((prev) => ({ ...prev, recipientPhone: event.target.value }))
              }
            />
            <Input
              className="soft-input h-11"
              placeholder="Provider (ixtiyoriy)"
              value={singleDraft.provider}
              onChange={(event) => setSingleDraft((prev) => ({ ...prev, provider: event.target.value }))}
            />
            <Textarea
              className="soft-input min-h-28"
              placeholder="Xabar matni"
              value={singleDraft.message}
              onChange={(event) => setSingleDraft((prev) => ({ ...prev, message: event.target.value }))}
            />
            <GradientButton className="h-11" onClick={sendSingle}>
              <Send className="mr-1 h-4 w-4" />
              SMS yuborish
            </GradientButton>
          </div>
        </article>

        <article className="panel-surface p-4">
          <h3 className="mb-3 text-base font-semibold text-[#2f3655]">Bulk SMS yuborish</h3>
          <div className="space-y-3">
            <Textarea
              className="soft-input min-h-24"
              placeholder="Qabul qiluvchilar (vergul yoki yangi qatordan): +99890..., +99891..."
              value={bulkDraft.recipientsText}
              onChange={(event) =>
                setBulkDraft((prev) => ({ ...prev, recipientsText: event.target.value }))
              }
            />
            <Input
              className="soft-input h-11"
              placeholder="Provider (ixtiyoriy)"
              value={bulkDraft.provider}
              onChange={(event) => setBulkDraft((prev) => ({ ...prev, provider: event.target.value }))}
            />
            <Textarea
              className="soft-input min-h-24"
              placeholder="Xabar matni"
              value={bulkDraft.message}
              onChange={(event) => setBulkDraft((prev) => ({ ...prev, message: event.target.value }))}
            />
            <GradientButton className="h-11" onClick={sendBulk}>
              <Send className="mr-1 h-4 w-4" />
              Bulk yuborish
            </GradientButton>
          </div>
        </article>
      </section>

      <section className="panel-surface p-4">
        <h3 className="mb-3 text-base font-semibold text-[#2f3655]">Template yaratish</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Input
            className="soft-input h-11"
            placeholder="Template nomi"
            value={templateDraft.name}
            onChange={(event) => setTemplateDraft((prev) => ({ ...prev, name: event.target.value }))}
          />
          <Textarea
            className="soft-input min-h-20 md:col-span-2"
            placeholder="Template matni"
            value={templateDraft.body}
            onChange={(event) => setTemplateDraft((prev) => ({ ...prev, body: event.target.value }))}
          />
          <Button
            variant="outline"
            className="h-11 rounded-xl border-[#dce3f5] md:col-span-3"
            onClick={createTemplate}
          >
            <Plus className="mr-1 h-4 w-4" />
            Template qo'shish
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <article className="panel-surface p-4">
          <h3 className="mb-3 text-base font-semibold text-[#2f3655]">
            Role bo'yicha notification
          </h3>
          <div className="space-y-3">
            <Select
              value={roleNotificationDraft.role}
              onValueChange={(value) =>
                setRoleNotificationDraft((prev) => ({
                  ...prev,
                  role: value ?? "STUDENT",
                }))
              }
            >
              <SelectTrigger className="soft-input h-11">
                <SelectValue placeholder="Qabul qiluvchi role" />
              </SelectTrigger>
              <SelectContent>
                {RECIPIENT_ROLE_OPTIONS.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="soft-input h-11"
              placeholder="Provider (ixtiyoriy)"
              value={roleNotificationDraft.provider}
              onChange={(event) =>
                setRoleNotificationDraft((prev) => ({
                  ...prev,
                  provider: event.target.value,
                }))
              }
            />
            <Textarea
              className="soft-input min-h-24"
              placeholder="Xabar matni"
              value={roleNotificationDraft.message}
              onChange={(event) =>
                setRoleNotificationDraft((prev) => ({
                  ...prev,
                  message: event.target.value,
                }))
              }
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-[#dce3f5]"
              onClick={sendRoleNotification}
            >
              Notification yuborish
            </Button>
          </div>
        </article>

        <article className="panel-surface p-4">
          <h3 className="mb-3 text-base font-semibold text-[#2f3655]">
            To'lov muddati reminder
          </h3>
          <div className="space-y-3">
            <Input
              className="soft-input h-11"
              type="number"
              min={1}
              max={30}
              placeholder="Necha kun oldin"
              value={dueReminderDraft.daysAhead}
              onChange={(event) =>
                setDueReminderDraft((prev) => ({
                  ...prev,
                  daysAhead: event.target.value,
                }))
              }
            />
            <Input
              className="soft-input h-11"
              placeholder="Provider (ixtiyoriy)"
              value={dueReminderDraft.provider}
              onChange={(event) =>
                setDueReminderDraft((prev) => ({
                  ...prev,
                  provider: event.target.value,
                }))
              }
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-[#dce3f5]"
              onClick={sendDuePaymentReminders}
            >
              Reminder yuborish
            </Button>
          </div>
        </article>

        <article className="panel-surface p-4">
          <h3 className="mb-3 text-base font-semibold text-[#2f3655]">
            Xodim oylik notification
          </h3>
          <div className="space-y-3">
            <Select
              value={staffSalaryDraft.staffUserId || "NONE"}
              onValueChange={(value) =>
                setStaffSalaryDraft((prev) => ({
                  ...prev,
                  staffUserId: (value ?? "NONE") === "NONE" ? "" : (value ?? ""),
                }))
              }
            >
              <SelectTrigger className="soft-input h-11">
                <SelectValue placeholder="Xodim" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Xodim tanlanmagan</SelectItem>
                {staffOptions.map((staff) => (
                  <SelectItem key={staff.id} value={staff.id}>
                    {staff.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              className="soft-input h-11"
              type="number"
              min={1}
              placeholder="To'lov summasi"
              value={staffSalaryDraft.amount}
              onChange={(event) =>
                setStaffSalaryDraft((prev) => ({
                  ...prev,
                  amount: event.target.value,
                }))
              }
            />
            <Input
              className="soft-input h-11"
              placeholder="Izoh"
              value={staffSalaryDraft.note}
              onChange={(event) =>
                setStaffSalaryDraft((prev) => ({
                  ...prev,
                  note: event.target.value,
                }))
              }
            />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl border-[#dce3f5]"
              onClick={sendStaffSalaryNotification}
            >
              Xodimga yuborish
            </Button>
          </div>
        </article>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <article className="panel-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-base font-semibold text-[#2f3655]">Template ro'yxati</h3>
            <Badge className="rounded-lg bg-[#ecf0ff] text-[#4f5ed9]">{templates.length}</Badge>
          </div>
          {!templates.length ? (
            <p className="text-sm text-[#8b95b3]">Template topilmadi</p>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => (
                <article key={template.id} className="rounded-xl border border-[#edf1fb] bg-[#fbfcff] p-3">
                  <p className="font-semibold text-[#2f3655]">{template.name}</p>
                  <p className="mt-1 text-sm text-[#616b8e]">{template.body}</p>
                  <p className="mt-1 text-xs text-[#8b95b3]">{formatDate(template.createdAt)}</p>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="panel-surface p-4">
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-base font-semibold text-[#2f3655]">SMS loglar</h3>
            <Badge className="rounded-lg bg-[#ecf0ff] text-[#4f5ed9]">{logs.length}</Badge>
          </div>
          <Input
            className="soft-input mb-3 h-11"
            placeholder="Telefon yoki xabar bo'yicha qidirish..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button
            variant="outline"
            className="mb-3 h-10 rounded-xl border-[#dce3f5]"
            onClick={loadData}
            disabled={loading}
          >
            Yangilash
          </Button>

          {!logs.length ? (
            <p className="text-sm text-[#8b95b3]">Loglar topilmadi</p>
          ) : (
            <div className="space-y-2">
              {logs.slice(0, 15).map((log) => (
                <article key={log.id} className="rounded-xl border border-[#edf1fb] bg-[#fbfcff] p-3 text-sm">
                  <div className="mb-1 flex items-center justify-between">
                    <p className="font-semibold text-[#2f3655]">{log.recipientPhone}</p>
                    <Badge variant="outline">{log.smsStatus}</Badge>
                  </div>
                  <p className="text-[#616b8e]">{log.message}</p>
                  <p className="mt-1 text-xs text-[#8b95b3]">{formatDate(log.createdAt)}</p>
                  {log.errorMessage ? (
                    <p className="mt-1 text-xs text-[#c44a63]">{log.errorMessage}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )}
        </article>
      </section>
    </DashboardLayout>
  );
}
