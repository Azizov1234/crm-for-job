"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  EmptyState,
  GradientButton,
  ModalShell,
  PageHero,
  SearchToolbar,
  StepSection,
} from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { notifyBranchesUpdated } from "@/lib/api/auth-storage";
import { branchesApi } from "@/lib/api/services";
import { Status } from "@/lib/types";
import { formatDate } from "@/lib/utils-helpers";

const STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"];
const MUTABLE_STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"];

type BranchRow = {
  id: string;
  name: string;
  code: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  logoUrl: string | null;
  status: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
};

type BranchDraft = {
  name: string;
  code: string;
  phone: string;
  email: string;
  address: string;
  logoUrl: string;
  status: Status;
};

const EMPTY_BRANCH_DRAFT: BranchDraft = {
  name: "",
  code: "",
  phone: "",
  email: "",
  address: "",
  logoUrl: "",
  status: "ACTIVE",
};

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asNullableString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function mapBranchRow(raw: unknown): BranchRow {
  const item = toRecord(raw);
  const status = asString(item.status) || "ACTIVE";
  return {
    id: asString(item.id),
    name: asString(item.name),
    code: asString(item.code),
    phone: asNullableString(item.phone),
    email: asNullableString(item.email),
    address: asNullableString(item.address),
    logoUrl: asNullableString(item.logoUrl),
    status,
    isActive: status === "ACTIVE",
    createdAt: asNullableString(item.createdAt),
    updatedAt: asNullableString(item.updatedAt),
  };
}

export default function BranchesPage() {
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [editingInitialStatus, setEditingInitialStatus] = useState<Status>("ACTIVE");
  const [draft, setDraft] = useState<BranchDraft>(EMPTY_BRANCH_DRAFT);
  const [editDraft, setEditDraft] = useState<BranchDraft>(EMPTY_BRANCH_DRAFT);

  const totalCount = useMemo(() => branches.length, [branches]);
  const editStatusOptions = useMemo(() => {
    if (
      editingInitialStatus &&
      !MUTABLE_STATUS_OPTIONS.includes(editingInitialStatus)
    ) {
      return [...MUTABLE_STATUS_OPTIONS, editingInitialStatus];
    }
    return MUTABLE_STATUS_OPTIONS;
  }, [editingInitialStatus]);

  async function loadBranches() {
    try {
      const response = await branchesApi.list({
        page: 1,
        limit: 200,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setBranches((response.data as unknown[]).map(mapBranchRow));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Filiallar yuklanmadi");
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadBranches();
    }, 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  async function createBranch() {
    if (!draft.name.trim() || !draft.code.trim()) {
      toast.error("Filial nomi va kodi majburiy");
      return;
    }

    try {
      await branchesApi.create({
        name: draft.name.trim(),
        code: draft.code.trim(),
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim() || undefined,
        address: draft.address.trim() || undefined,
        logoUrl: draft.logoUrl.trim() || undefined,
      });

      toast.success("Filial yaratildi");
      setOpenCreateModal(false);
      setDraft(EMPTY_BRANCH_DRAFT);
      await loadBranches();
      notifyBranchesUpdated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Filial yaratishda xatolik");
    }
  }

  async function openEditBranch(id: string) {
    try {
      const response = await branchesApi.getById(id);
      const item = toRecord(response);
      const nextStatus = (asString(item.status) || "ACTIVE") as Status;

      setEditingBranchId(id);
      setEditingInitialStatus(nextStatus);
      setEditDraft({
        name: asString(item.name),
        code: asString(item.code),
        phone: asString(item.phone),
        email: asString(item.email),
        address: asString(item.address),
        logoUrl: asString(item.logoUrl),
        status: nextStatus,
      });
      setOpenEditModal(true);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Filial ma'lumoti olinmadi");
    }
  }

  async function updateBranch() {
    if (!editingBranchId) return;

    if (!editDraft.name.trim() || !editDraft.code.trim()) {
      toast.error("Filial nomi va kodi majburiy");
      return;
    }

    try {
      await branchesApi.update(editingBranchId, {
        name: editDraft.name.trim(),
        code: editDraft.code.trim(),
        phone: editDraft.phone.trim() || undefined,
        email: editDraft.email.trim() || undefined,
        address: editDraft.address.trim() || undefined,
        logoUrl: editDraft.logoUrl.trim() || undefined,
      });

      if (editDraft.status !== editingInitialStatus && editDraft.status === "DELETED") {
        await branchesApi.remove(editingBranchId);
      } else if (editDraft.status !== editingInitialStatus) {
        await branchesApi.changeStatus(editingBranchId, editDraft.status);
      }

      toast.success("Filial yangilandi");
      setOpenEditModal(false);
      setEditingBranchId(null);
      await loadBranches();
      notifyBranchesUpdated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Filial yangilanmadi");
    }
  }

  async function softDeleteBranch(id: string) {
    try {
      await branchesApi.remove(id);
      toast.success("Filial o'chirildi");
      await loadBranches();
      notifyBranchesUpdated();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Filialni o'chirishda xatolik");
    }
  }

  return (
    <DashboardLayout title="Filiallar" description="Filiallarni boshqarish paneli">
      <PageHero
        title="Filiallar"
        subtitle="Filiallarni yaratish, yangilash va statusini boshqarish"
        icon={Building2}
        statLabel="Jami filiallar"
        statValue={totalCount}
      />

      <SearchToolbar
        value={search}
        onChange={setSearch}
        onFilter={loadBranches}
        placeholder="Filiallar ichidan qidiring..."
        actions={
          <>
            <Select value={status} onValueChange={(value) => setStatus(value ?? "ALL")}>
              <SelectTrigger className="h-11 rounded-xl border-[#e3e8f4] bg-white">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Barcha status</SelectItem>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <GradientButton className="h-11 rounded-xl px-4" onClick={() => setOpenCreateModal(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Filial qo'shish
            </GradientButton>
          </>
        }
      />

      {!branches.length ? (
        <EmptyState
          title="Filiallar topilmadi"
          subtitle="Filterlarni tekshiring yoki yangi filial qo'shing."
          action={
            <GradientButton className="rounded-xl px-5" onClick={() => setOpenCreateModal(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Filial qo'shish
            </GradientButton>
          }
        />
      ) : (
        <section className="panel-surface overflow-hidden">
          <div className="grid grid-cols-[1.3fr_0.9fr_1fr_0.9fr_0.9fr_0.8fr_0.6fr] gap-3 border-b border-[#edf1fb] bg-[#f6f8fe] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f99b7]">
            <span>Filial</span>
            <span>Kod</span>
            <span>Aloqa</span>
            <span>Manzil</span>
            <span>Yangilangan</span>
            <span>Status</span>
            <span className="text-right">Amallar</span>
          </div>
          <div className="divide-y divide-[#edf1fb]">
            {branches.map((branch) => (
              <div
                key={branch.id}
                className="grid grid-cols-[1.3fr_0.9fr_1fr_0.9fr_0.9fr_0.8fr_0.6fr] items-center gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#2f3655]">{branch.name}</p>
                  <p className="text-xs text-[#8f99b7]">{branch.id}</p>
                </div>
                <span className="text-[#616b8e]">{branch.code || "-"}</span>
                <span className="text-[#616b8e]">{branch.phone ?? branch.email ?? "-"}</span>
                <span className="truncate text-[#616b8e]">{branch.address ?? "-"}</span>
                <span className="text-[#616b8e]">{formatDate(branch.updatedAt ?? branch.createdAt)}</span>
                <Badge variant={branch.isActive ? "secondary" : "outline"}>{branch.status}</Badge>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-700 hover:bg-[#eef2ff]"
                    disabled={branch.status === "DELETED"}
                    onClick={() => openEditBranch(branch.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#c7475c] hover:bg-[#fff0f3]"
                    onClick={() => softDeleteBranch(branch.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <ModalShell
        open={openCreateModal}
        onClose={() => setOpenCreateModal(false)}
        title="Yangi filial"
        subtitle="Filial ma'lumotlarini kiriting"
      >
        <div className="space-y-4">
          <StepSection step={1} title="Asosiy ma'lumotlar" hint="Nomi va kodi majburiy">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Filial nomi *">
                <Input
                  className="soft-input h-11"
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Main Branch"
                />
              </Field>
              <Field label="Filial kodi *">
                <Input
                  className="soft-input h-11"
                  value={draft.code}
                  onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="MAIN"
                />
              </Field>
              <Field label="Telefon">
                <Input
                  className="soft-input h-11"
                  value={draft.phone}
                  onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+998901234567"
                />
              </Field>
              <Field label="Email">
                <Input
                  className="soft-input h-11"
                  value={draft.email}
                  onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="branch@academy.uz"
                />
              </Field>
              <Field label="Logo URL">
                <Input
                  className="soft-input h-11"
                  value={draft.logoUrl}
                  onChange={(event) => setDraft((prev) => ({ ...prev, logoUrl: event.target.value }))}
                  placeholder="https://..."
                />
              </Field>
              <Field label="Manzil" className="md:col-span-2">
                <Textarea
                  className="soft-input min-h-20"
                  value={draft.address}
                  onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Toshkent, ..."
                />
              </Field>
            </div>
          </StepSection>

          <GradientButton className="h-12 w-full rounded-xl text-base" onClick={createBranch}>
            Filial yaratish
          </GradientButton>
        </div>
      </ModalShell>

      <ModalShell
        open={openEditModal}
        onClose={() => {
          setOpenEditModal(false);
          setEditingBranchId(null);
        }}
        title="Filialni yangilash"
        subtitle="Filial ma'lumotlarini tahrirlash"
      >
        <div className="space-y-4">
          <StepSection step={1} title="Asosiy ma'lumotlar" hint="Status o'zgarishi alohida endpoint orqali yuboriladi">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Filial nomi *">
                <Input
                  className="soft-input h-11"
                  value={editDraft.name}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Main Branch"
                />
              </Field>
              <Field label="Filial kodi *">
                <Input
                  className="soft-input h-11"
                  value={editDraft.code}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="MAIN"
                />
              </Field>
              <Field label="Telefon">
                <Input
                  className="soft-input h-11"
                  value={editDraft.phone}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+998901234567"
                />
              </Field>
              <Field label="Email">
                <Input
                  className="soft-input h-11"
                  value={editDraft.email}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="branch@academy.uz"
                />
              </Field>
              <Field label="Logo URL">
                <Input
                  className="soft-input h-11"
                  value={editDraft.logoUrl}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, logoUrl: event.target.value }))}
                  placeholder="https://..."
                />
              </Field>
              <Field label="Status">
                <Select
                  value={editDraft.status}
                  onValueChange={(value) =>
                    setEditDraft((prev) => ({ ...prev, status: (value ?? "ACTIVE") as Status }))
                  }
                >
                  <SelectTrigger className="soft-input h-11">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {editStatusOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Manzil" className="md:col-span-2">
                <Textarea
                  className="soft-input min-h-20"
                  value={editDraft.address}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Toshkent, ..."
                />
              </Field>
            </div>
          </StepSection>

          <GradientButton className="h-12 w-full rounded-xl text-base" onClick={updateBranch}>
            Filialni yangilash
          </GradientButton>
        </div>
      </ModalShell>
    </DashboardLayout>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={className ? `space-y-1 ${className}` : "space-y-1"}>
      <span className="text-xs font-medium text-[#7c87a9]">{label}</span>
      {children}
    </label>
  );
}
