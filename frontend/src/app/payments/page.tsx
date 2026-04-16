"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { Filter, Plus, Search, Trash2, Wallet, User as UserIcon, Users as UsersIcon, Check, Clock, AlertCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmptyState, GradientButton, PageHero } from "@/components/shared";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { getActiveBranchId } from "@/lib/api/auth-storage";
import { groupsApi, paymentsApi, studentsApi } from "@/lib/api/services";
import { Payment, PaymentStatus } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils-helpers";

type Option = { id: string; name: string };

type PaymentStats = {
  total: number;
  collected: number;
  remaining: number;
  count: number;
  byStatus: Array<{
    status: string;
    count: number;
    amount: number;
    paidAmount: number;
  }>;
};

const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = [
  "PENDING",
  "PARTIAL",
  "PAID",
  "OVERDUE",
  "CANCELLED",
];

export default function PaymentsPage() {
  const now = useMemo(() => new Date(), []);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [students, setStudents] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [studentGroups, setStudentGroups] = useState<Option[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [draft, setDraft] = useState({
    studentId: "",
    groupId: "",
    amount: "",
    paidAmount: "",
    paymentStatus: "PENDING" as PaymentStatus,
    month: String(now.getMonth() + 1),
    year: String(now.getFullYear()),
    dueDate: "",
    note: "",
  });

  async function loadData() {
    try {
      setLoading(true);
      const [paymentsRes, studentsRes, groupsRes, statsRes] = await Promise.all([
        paymentsApi.list({
          page: 1,
          limit: 100,
          search: search || undefined,
          paymentStatus: status === "ALL" ? undefined : status,
        }),
        studentsApi.selectOptions(),
        groupsApi.list({ page: 1, limit: 100, status: "ACTIVE" }),
        paymentsApi.stats(),
      ]);
      setPayments(paymentsRes.data);
      setStudents(studentsRes);
      setGroups(groupsRes.data.map((item) => ({ id: item.id, name: item.name })));
      setStats(statsRes as PaymentStats);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "To'lovlar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [status]); // Reloads when filter status changes

  async function createPayment() {
    if (!draft.studentId || !draft.amount || !draft.month || !draft.year) {
      toast.error("O'quvchi, summa, oy va yil majburiy");
      return;
    }

    try {
      await paymentsApi.create({
        studentId: draft.studentId,
        groupId: draft.groupId || undefined,
        amount: Number(draft.amount),
        paidAmount: draft.paidAmount ? Number(draft.paidAmount) : undefined,
        paymentStatus: draft.paymentStatus,
        month: Number(draft.month),
        year: Number(draft.year),
        dueDate: draft.dueDate || undefined,
        note: draft.note.trim() || undefined,
        branchId: getActiveBranchId() || undefined,
      });
      toast.success("To'lov yaratildi");
      setDraft({
        studentId: "",
        groupId: "",
        amount: "",
        paidAmount: "",
        paymentStatus: "PENDING",
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
        dueDate: "",
        note: "",
      });
      setStudentGroups([]);
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "To'lov yaratilmadi");
    }
  }

  async function loadStudentGroups(studentId: string) {
    if (!studentId) {
      setStudentGroups([]);
      return;
    }

    try {
      const data = (await studentsApi.getById(studentId)) as {
        groupLinks?: Array<{ group?: { id: string; name: string } }>;
      };
      const linkedGroups =
        data.groupLinks
          ?.map((item) =>
            item.group ? { id: item.group.id, name: item.group.name } : null,
          )
          .filter((item): item is Option => Boolean(item)) ?? [];
      setStudentGroups(linkedGroups);
      setDraft((prev) => ({
        ...prev,
        groupId: linkedGroups.some((group) => group.id === prev.groupId)
          ? prev.groupId
          : "",
      }));
    } catch (error) {
      setStudentGroups([]);
      toast.error(
        error instanceof ApiError ? error.message : "Student guruhlari olinmadi",
      );
    }
  }

  async function softDeletePayment(id: string) {
    try {
      await paymentsApi.remove(id);
      toast.success("To'lov o'chirildi");
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete amalga oshmadi");
    }
  }

  const getStatusBadge = (statusStr: string) => {
    switch (statusStr) {
      case "PAID":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f9f0] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#1a9958]">
            <Check className="h-3 w-3" /> To'langan
          </span>
        );
      case "PENDING":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f3fb] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#5f6c8d]">
            <Clock className="h-3 w-3" /> Kutilmoqda
          </span>
        );
      case "PARTIAL":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fef3e2] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#b86a0a]">
            <Wallet className="h-3 w-3" /> Qisman
          </span>
        );
      case "OVERDUE":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#fde8ec] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#c02040]">
            <AlertCircle className="h-3 w-3" /> Qarzdorlik
          </span>
        );
      case "CANCELLED":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f3f4f6] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#9ca3af]">
            <XCircle className="h-3 w-3" /> Bekor qilingan
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#f0f3fb] px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-[#5f6c8d]">
            {statusStr}
          </span>
        );
    }
  };

  return (
    <DashboardLayout title="To'lovlar" description="Payment va payment history boshqaruvi">
      <PageHero
        title="To'lovlar"
        subtitle="To'lov oqimi, qarzdorlik holati va to'lovlar ro'yxati"
        icon={Wallet}
        statLabel="Jami to'lovlar"
        statValue={stats?.count ?? payments.length}
      />

      {/* Summary Cards */}
      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ColorSummaryCard 
          title="Yig'ilgan" 
          value={formatCurrency(stats?.collected ?? 0)} 
          badgeColor="linear-gradient(135deg, #22c484, #19a868)" 
        />
        <ColorSummaryCard 
          title="Qolgan" 
          value={formatCurrency(stats?.remaining ?? 0)} 
          badgeColor="linear-gradient(135deg, #f0a830, #e08820)" 
        />
        <ColorSummaryCard 
          title="Qarz" 
          value={formatCurrency(Math.max((stats?.remaining ?? 0) - 0, 0))} 
          badgeColor="linear-gradient(135deg, #e04060, #c82848)" 
        />
        <ColorSummaryCard 
          title="Jami summa" 
          value={formatCurrency(stats?.total ?? 0)} 
          badgeColor="linear-gradient(135deg, #4f63de, #8342ef)" 
        />
      </section>

      {/* New Payment Form */}
      <section className="panel-surface p-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#eef1ff] text-[#4f63de]">
            <Wallet className="h-4 w-4" />
          </div>
          <h3 className="text-[15px] font-bold text-[#1e2340]">Yangi to'lov qo'shish</h3>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4 xl:grid-cols-8">
          <div className="xl:col-span-2">
            <Select
              value={draft.studentId || "NONE"}
              onValueChange={(value) =>
                void (async () => {
                  const studentId = (value ?? "NONE") === "NONE" ? "" : (value ?? "");
                  setDraft((prev) => ({ ...prev, studentId }));
                  await loadStudentGroups(studentId);
                })()
              }
            >
              <SelectTrigger className="soft-input h-[42px] w-full bg-[#f8faff] text-[#1e2340]">
                <SelectValue placeholder="O'quvchini tanlang" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="NONE">O'quvchini tanlang</SelectItem>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>{student.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="xl:col-span-2">
            <Select
              value={draft.groupId || "NONE"}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  groupId: (value ?? "NONE") === "NONE" ? "" : (value ?? ""),
                }))
              }
            >
              <SelectTrigger className="soft-input h-[42px] w-full bg-[#f8faff] text-[#1e2340]">
                <SelectValue placeholder="Guruh (ixtiyoriy)" />
              </SelectTrigger>
              <SelectContent className="bg-white">
                <SelectItem value="NONE">Asosiy ro'yxat, guruhsiz</SelectItem>
                {(studentGroups.length ? studentGroups : groups).map((group) => (
                  <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Input
            className="soft-input h-[42px] bg-[#f8faff]"
            type="number"
            placeholder="Jami summa"
            value={draft.amount}
            onChange={(e) => setDraft((prev) => ({ ...prev, amount: e.target.value }))}
          />
          <Input
            className="soft-input h-[42px] bg-[#f8faff]"
            type="number"
            placeholder="To'langan"
            value={draft.paidAmount}
            onChange={(e) => setDraft((prev) => ({ ...prev, paidAmount: e.target.value }))}
          />

          <Select
            value={draft.paymentStatus}
            onValueChange={(value) =>
              setDraft((prev) => ({ ...prev, paymentStatus: (value ?? "PENDING") as PaymentStatus }))
            }
          >
            <SelectTrigger className="soft-input h-[42px] bg-[#f8faff] text-[#1e2340]">
              <SelectValue placeholder="Holat" />
            </SelectTrigger>
            <SelectContent className="bg-white">
              {PAYMENT_STATUS_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>{option}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Input
            className="soft-input h-[42px] bg-[#f8faff]"
            type="number"
            min={1}
            max={12}
            placeholder="Oy"
            value={draft.month}
            onChange={(e) => setDraft((prev) => ({ ...prev, month: e.target.value }))}
          />
          <Input
            className="soft-input h-[42px] bg-[#f8faff]"
            type="number"
            placeholder="Yil"
            value={draft.year}
            onChange={(e) => setDraft((prev) => ({ ...prev, year: e.target.value }))}
          />
          <Input
            className="soft-input h-[42px] bg-[#f8faff] xl:col-span-2"
            type="date"
            placeholder="Muddati"
            value={draft.dueDate}
            onChange={(e) => setDraft((prev) => ({ ...prev, dueDate: e.target.value }))}
          />
          <Input
            className="soft-input h-[42px] bg-[#f8faff] md:col-span-2 xl:col-span-3"
            placeholder="Izoh (ixtiyoriy)..."
            value={draft.note}
            onChange={(e) => setDraft((prev) => ({ ...prev, note: e.target.value }))}
          />
          <div className="md:col-span-4 xl:col-span-8 flex justify-end">
            <GradientButton size="md" onClick={createPayment}>
              To'lovni yaratish
            </GradientButton>
          </div>
        </div>
      </section>

      {/* Filter and List */}
      <section className="panel-surface p-5">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative w-full max-w-[360px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-[#8c95ad]" />
            <Input
              className="soft-input h-[42px] pl-[38px] bg-[#f8faff]"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="O'quvchi ism-familiyasi..."
            />
          </div>

          <div className="flex w-full flex-wrap items-center gap-1.5 rounded-xl border border-[#e4e9f5] bg-[#fafbff] p-1.5 lg:w-auto">
            <button
              onClick={() => setStatus("ALL")}
              className={`rounded-lg px-3.5 py-[6px] text-[13px] font-semibold transition-colors ${
                status === "ALL" 
                  ? "bg-white text-[#4158ca] shadow-[0_2px_8px_-2px_rgba(63,86,210,0.15)]" 
                  : "text-[#7a88ae] hover:text-[#4158ca]"
              }`}
            >
              Barchasi
            </button>
            {PAYMENT_STATUS_OPTIONS.map((option) => (
              <button
                key={option}
                onClick={() => setStatus(option)}
                className={`rounded-lg px-3.5 py-[6px] text-[13px] font-semibold transition-colors ${
                  status === option
                    ? "bg-white text-[#4158ca] shadow-[0_2px_8px_-2px_rgba(63,86,210,0.15)]"
                    : "text-[#7a88ae] hover:text-[#4158ca]"
                }`}
              >
                {option}
              </button>
            ))}
            <button 
              onClick={loadData} 
              disabled={loading}
              className="ml-2 flex h-8 w-8 items-center justify-center rounded-lg bg-white text-[#4158ca] shadow-[0_2px_8px_-2px_rgba(63,86,210,0.15)] hover:bg-[#f8faff] disabled:opacity-50"
            >
              <Filter className="h-4 w-4" />
            </button>
          </div>
        </div>

        {!payments.length ? (
          <EmptyState
            title="To'lovlar topilmadi"
            subtitle="Qidiruv so'zini yoki filterni o'zgartirib ko'ring."
          />
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[#e4e9f5]">
            <table className="data-table">
              <thead>
                <tr>
                  <th>O'quvchi</th>
                  <th>Guruh</th>
                  <th>Summa</th>
                  <th>To'langan</th>
                  <th>Holat</th>
                  <th>Davr</th>
                  <th>Yaratilgan</th>
                  <th className="text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {payments.map((payment) => (
                  <tr key={payment.id} className="transition-colors hover:bg-[#f8faff]">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f0f3fb] text-[#4158ca]">
                          <UserIcon className="h-4 w-4" />
                        </div>
                        <span className="font-semibold text-[#1e2340]">{payment.studentName}</span>
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2 text-[#5a6388]">
                        <UsersIcon className="h-[14px] w-[14px]" />
                        <span>{payment.groupName ?? "Guruhsiz"}</span>
                      </div>
                    </td>
                    <td className="font-semibold text-[#1e2340]">{formatCurrency(payment.amount)}</td>
                    <td className="font-bold text-[#19a868]">{formatCurrency(payment.paidAmount)}</td>
                    <td>
                      {getStatusBadge(payment.paymentStatus)}
                    </td>
                    <td className="text-[#5a6388]">
                      {payment.month}/{payment.year}
                    </td>
                    <td className="text-[#8898c0] text-[12px]">{formatDate(payment.createdAt)}</td>
                    <td className="text-right">
                      <button
                        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[#c02040] hover:bg-[#fde8ec] transition-colors"
                        onClick={() => softDeletePayment(payment.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

function ColorSummaryCard({
  title,
  value,
  badgeColor,
}: {
  title: string;
  value: string;
  badgeColor: string;
}) {
  return (
    <article className="panel-surface p-[18px] relative overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-8px_rgba(30,50,120,0.15)]">
      <div 
        className="absolute -right-6 -top-6 h-[88px] w-[88px] rounded-full opacity-10"
        style={{ background: badgeColor }} 
      />
      <div className="flex flex-col gap-2 relative z-10">
        <div className="flex items-center gap-2">
          <div 
            className="w-2.5 h-2.5 rounded-full" 
            style={{ background: badgeColor }} 
          />
          <p className="text-[11.5px] font-bold uppercase tracking-[0.1em] text-[#8898c0]">
            {title}
          </p>
        </div>
        <p className="text-[26px] font-[800] text-[#1e2340] leading-none" style={{ fontFamily: "var(--font-space-grotesk)" }}>
          {value}
        </p>
      </div>
    </article>
  );
}
