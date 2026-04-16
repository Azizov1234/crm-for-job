"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useState } from "react";
import { BarChart3, Filter, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { GradientButton, PageHero } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { getActiveBranchId } from "@/lib/api/auth-storage";
import { financeApi, usersApi } from "@/lib/api/services";
import { formatCurrency, formatDate } from "@/lib/utils-helpers";

type Expense = {
  id: string;
  title: string;
  category: string;
  amount: number | string;
  expenseDate: string;
  paidBy?: string | null;
  note?: string | null;
};

type FinanceSummary = {
  income: number;
  expense: number;
  balance: number;
};

type CashflowItem = {
  month: string;
  income: number;
  expense: number;
  balance: number;
};

type StaffOption = {
  id: string;
  name: string;
};

export default function FinancePage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<FinanceSummary>({ income: 0, expense: 0, balance: 0 });
  const [cashflow, setCashflow] = useState<CashflowItem[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    category: "",
    amount: "",
    expenseDate: "",
    paidBy: "",
    paidByMode: "TEXT",
    note: "",
  });

  async function loadData() {
    try {
      setLoading(true);
      const [expensesRes, summaryRes, cashflowRes, staffRes] = await Promise.all([
        financeApi.expenses.list({
          page: 1,
          limit: 100,
          search: search || undefined,
        }),
        financeApi.summary(),
        financeApi.cashflow(),
        usersApi.list({
          page: 1,
          limit: 100,
          role: "STAFF",
          status: "ACTIVE",
        }),
      ]);

      setExpenses((expensesRes.data as Expense[]) ?? []);
      setSummary(
        ((summaryRes as { data?: FinanceSummary }).data ??
          (summaryRes as FinanceSummary)) as FinanceSummary,
      );
      setCashflow(
        ((cashflowRes as { data?: CashflowItem[] }).data ??
          (cashflowRes as CashflowItem[])) as CashflowItem[],
      );
      setStaffOptions(
        staffRes.data.map((item) => ({
          id: item.id,
          name: item.name,
        })),
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Moliya ma'lumotlari yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [search]);

  async function createExpense() {
    if (!draft.title.trim() || !draft.category.trim() || !draft.amount || !draft.expenseDate) {
      toast.error("Sarlavha, kategoriya, summa va sana majburiy");
      return;
    }
    try {
      await financeApi.expenses.create({
        title: draft.title.trim(),
        category: draft.category.trim(),
        amount: Number(draft.amount),
        expenseDate: draft.expenseDate,
        paidBy: draft.paidBy.trim() || undefined,
        note: draft.note.trim() || undefined,
        branchId: getActiveBranchId() || undefined,
      });
      toast.success("Xarajat qo'shildi");
      setDraft({
        title: "",
        category: "",
        amount: "",
        expenseDate: "",
        paidBy: "",
        paidByMode: "TEXT",
        note: "",
      });
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Xarajat yaratilmadi");
    }
  }

  async function deleteExpense(id: string) {
    try {
      await financeApi.expenses.remove(id);
      toast.success("Xarajat o'chirildi");
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete amalga oshmadi");
    }
  }

  return (
    <DashboardLayout title="Moliya" description="Xarajatlar, cashflow va umumiy balans">
      <PageHero
        title="Moliya"
        subtitle="Kirim-chiqim oqimi va xarajatlarni nazorat qiling"
        icon={BarChart3}
        statLabel="Balans"
        statValue={formatCurrency(summary.balance)}
      />

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryCard title="Kirim" value={formatCurrency(summary.income)} className="bg-[#12a876]" />
        <SummaryCard title="Xarajat" value={formatCurrency(summary.expense)} className="bg-[#ef2f5e]" />
        <SummaryCard title="Balans" value={formatCurrency(summary.balance)} className="bg-[#3f4e66]" />
      </section>

      <section className="panel-surface p-4">
        <h3 className="mb-3 text-base font-semibold text-[#2f3655]">Yangi xarajat</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <Input
            className="soft-input h-11"
            placeholder="Sarlavha"
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
          />
          <Input
            className="soft-input h-11"
            placeholder="Kategoriya"
            value={draft.category}
            onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
          />
          <Input
            className="soft-input h-11"
            type="number"
            placeholder="Summa"
            value={draft.amount}
            onChange={(event) => setDraft((prev) => ({ ...prev, amount: event.target.value }))}
          />
          <Input
            className="soft-input h-11"
            type="date"
            value={draft.expenseDate}
            onChange={(event) => setDraft((prev) => ({ ...prev, expenseDate: event.target.value }))}
          />
          <Select
            value={draft.paidByMode}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                paidByMode: value ?? "TEXT",
                paidBy: value === "STAFF" ? "" : prev.paidBy,
              }))
            }
          >
            <SelectTrigger className="soft-input h-11">
              <SelectValue placeholder="To'lovchi turi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TEXT">Oddiy matn</SelectItem>
              <SelectItem value="STAFF">Xodim (ID)</SelectItem>
            </SelectContent>
          </Select>
          {draft.paidByMode === "STAFF" ? (
            <Select
              value={draft.paidBy || "NONE"}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  paidBy: (value ?? "NONE") === "NONE" ? "" : (value ?? ""),
                }))
              }
            >
              <SelectTrigger className="soft-input h-11">
                <SelectValue placeholder="Xodimni tanlang" />
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
          ) : (
            <Input
              className="soft-input h-11"
              placeholder="To'lovchi"
              value={draft.paidBy}
              onChange={(event) => setDraft((prev) => ({ ...prev, paidBy: event.target.value }))}
            />
          )}
          <Input
            className="soft-input h-11"
            placeholder="Izoh"
            value={draft.note}
            onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
          />
          <GradientButton className="h-11 md:col-span-6" onClick={createExpense}>
            <Plus className="mr-1 h-4 w-4" />
            Xarajat qo'shish
          </GradientButton>
        </div>
      </section>

      <section className="panel-surface p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <Input
            className="soft-input h-11 min-w-[220px] flex-1"
            placeholder="Xarajat qidirish..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <Button variant="outline" className="h-11 rounded-xl border-[#e3e8f4]" onClick={loadData} disabled={loading}>
            <Filter className="mr-1 h-4 w-4" />
            Filterlash
          </Button>
        </div>

        {!expenses.length ? (
          <div className="rounded-2xl border border-[#e5ebf7] bg-[#fbfcff] px-4 py-16 text-center text-[#8b95b3]">
            Xarajatlar topilmadi
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#edf1fb]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f8fe] text-xs uppercase tracking-[0.11em] text-[#8e98b7]">
                <tr>
                  <th className="px-4 py-3 text-left">Sarlavha</th>
                  <th className="px-4 py-3 text-left">Kategoriya</th>
                  <th className="px-4 py-3 text-left">Summa</th>
                  <th className="px-4 py-3 text-left">Sana</th>
                  <th className="px-4 py-3 text-left">To'lovchi</th>
                  <th className="px-4 py-3 text-left">Izoh</th>
                  <th className="px-4 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1fb] bg-white">
                {expenses.map((expense) => (
                  <tr key={expense.id}>
                    <td className="px-4 py-3 text-[#2f3655]">{expense.title}</td>
                    <td className="px-4 py-3 text-[#616b8e]">{expense.category}</td>
                    <td className="px-4 py-3 text-[#2f3655]">{formatCurrency(Number(expense.amount))}</td>
                    <td className="px-4 py-3 text-[#616b8e]">{formatDate(expense.expenseDate)}</td>
                    <td className="px-4 py-3 text-[#616b8e]">{expense.paidBy ?? "-"}</td>
                    <td className="px-4 py-3 text-[#616b8e]">{expense.note ?? "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#c7475c] hover:bg-[#fff0f3]"
                        onClick={() => deleteExpense(expense.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel-surface p-4">
        <h3 className="mb-3 text-base font-semibold text-[#2f3655]">Cashflow</h3>
        {!cashflow.length ? (
          <p className="text-sm text-[#8b95b3]">Cashflow ma'lumotlari topilmadi</p>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
            {cashflow.map((item) => (
              <article key={item.month} className="rounded-xl border border-[#edf1fb] bg-[#fbfcff] p-3">
                <p className="text-sm font-semibold text-[#2f3655]">{item.month}</p>
                <p className="text-xs text-[#6f7ca2]">Kirim: {formatCurrency(item.income)}</p>
                <p className="text-xs text-[#6f7ca2]">Xarajat: {formatCurrency(item.expense)}</p>
                <p className="mt-1 text-sm font-semibold text-[#4757d6]">
                  Balans: {formatCurrency(item.balance)}
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </DashboardLayout>
  );
}

function SummaryCard({
  title,
  value,
  className,
}: {
  title: string;
  value: string;
  className: string;
}) {
  return (
    <article className={`relative overflow-hidden rounded-2xl px-4 py-3 text-white ${className}`}>
      <div className="absolute -right-4 -top-4 h-12 w-12 rounded-full bg-white/15" />
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-white/80">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </article>
  );
}
