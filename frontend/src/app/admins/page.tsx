"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Pencil, Plus, ShieldCheck, Trash2, UserPlus2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  AvatarUploadField,
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
import { getActiveBranchId } from "@/lib/api/auth-storage";
import { adminsApi, branchesApi, usersApi } from "@/lib/api/services";
import { Status } from "@/lib/types";
import { formatDate } from "@/lib/utils-helpers";

const STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"];
const MUTABLE_STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED"];
const ADMIN_ROLE_OPTIONS = ["ADMIN", "STAFF"] as const;

type AdminRole = (typeof ADMIN_ROLE_OPTIONS)[number];

type AdminRow = {
  id: string;
  userId: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  role: string;
  branchId: string | null;
  branchName: string | null;
  status: string;
  isActive: boolean;
  createdAt: string | null;
};

type Option = { id: string; name: string };

type AdminDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  notes: string;
  avatarUrl: string;
  branchId: string;
  status: Status;
  role: AdminRole;
};

const EMPTY_ADMIN_DRAFT: AdminDraft = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  password: "",
  notes: "",
  avatarUrl: "",
  branchId: "",
  status: "ACTIVE",
  role: "ADMIN",
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

function normalizeAdminRole(value: string): AdminRole {
  return value === "STAFF" ? "STAFF" : "ADMIN";
}

function mapAdminRow(raw: unknown): AdminRow {
  const item = toRecord(raw);
  const user = toRecord(item.user);
  const branch = toRecord(item.branch);
  const firstName = asString(user.firstName).trim();
  const lastName = asString(user.lastName).trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const status = asString(item.status) || "ACTIVE";

  return {
    id: asString(item.id),
    userId: asString(item.userId),
    fullName: fullName || "Noma'lum",
    firstName,
    lastName,
    phone: asNullableString(user.phone),
    email: asNullableString(user.email),
    notes: asNullableString(item.notes),
    role: asString(user.role) || "ADMIN",
    branchId: asNullableString(item.branchId),
    branchName: asNullableString(branch.name),
    status,
    isActive: status === "ACTIVE",
    createdAt: asNullableString(item.createdAt),
  };
}

export default function AdminsPage() {
  const [admins, setAdmins] = useState<AdminRow[]>([]);
  const [users, setUsers] = useState<Option[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ACTIVE");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingAdminId, setEditingAdminId] = useState<string | null>(null);
  const [editingInitialStatus, setEditingInitialStatus] = useState<Status>("ACTIVE");
  const [editingInitialRole, setEditingInitialRole] = useState<AdminRole>("ADMIN");
  const [draft, setDraft] = useState<AdminDraft>(EMPTY_ADMIN_DRAFT);
  const [editDraft, setEditDraft] = useState<AdminDraft>(EMPTY_ADMIN_DRAFT);
  const [branches, setBranches] = useState<Option[]>([]);
  const [attachUserId, setAttachUserId] = useState("NONE");
  const [attachBranchId, setAttachBranchId] = useState("");
  const [attachNotes, setAttachNotes] = useState("");

  const totalCount = useMemo(() => admins.length, [admins]);

  async function loadAdmins() {
    try {
      const response = await adminsApi.list({
        page: 1,
        limit: 100,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setAdmins((response.data as unknown[]).map(mapAdminRow));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Adminlar yuklanmadi");
    }
  }

  async function loadUsers() {
    try {
      const response = await usersApi.selectOptions();
      setUsers(response.map((item) => ({ id: item.id, name: item.name })));
    } catch {
      setUsers([]);
    }
  }

  async function loadBranches() {
    try {
      const response = await branchesApi.list({ page: 1, limit: 200, status: "ACTIVE" });
      const options = (response.data as Array<{ id: string; name: string }>).map((branch) => ({
        id: branch.id,
        name: branch.name,
      }));
      setBranches(options);

      const persistedBranchId = getActiveBranchId();
      const defaultBranchId =
        (persistedBranchId && options.some((item) => item.id === persistedBranchId)
          ? persistedBranchId
          : options[0]?.id) ?? "";

      setDraft((prev) => ({
        ...prev,
        branchId: prev.branchId && options.some((item) => item.id === prev.branchId) ? prev.branchId : defaultBranchId,
      }));
      setAttachBranchId((prev) =>
        prev && options.some((item) => item.id === prev) ? prev : defaultBranchId,
      );
      setEditDraft((prev) => ({
        ...prev,
        branchId: prev.branchId && options.some((item) => item.id === prev.branchId) ? prev.branchId : defaultBranchId,
      }));
    } catch {
      setBranches([]);
      setDraft((prev) => ({ ...prev, branchId: "" }));
      setAttachBranchId("");
      setEditDraft((prev) => ({ ...prev, branchId: "" }));
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadAdmins();
    }, 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  useEffect(() => {
    void loadUsers();
    void loadBranches();
  }, []);

  async function createAdmin() {
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      toast.error("Ism va familiya majburiy");
      return;
    }
    if (!draft.branchId) {
      toast.error("Admin uchun filialni tanlang");
      return;
    }

    try {
      await adminsApi.create({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim() || undefined,
        password: draft.password.trim() || undefined,
        notes: draft.notes.trim() || undefined,
        avatarUrl: draft.avatarUrl.trim() || undefined,
        branchId: draft.branchId,
      });
      toast.success("Yangi admin yaratildi");
      setOpenCreateModal(false);
      setDraft({ ...EMPTY_ADMIN_DRAFT, branchId: getActiveBranchId() ?? branches[0]?.id ?? "" });
      setAttachUserId("NONE");
      setAttachBranchId(getActiveBranchId() ?? branches[0]?.id ?? "");
      setAttachNotes("");
      await loadAdmins();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Yaratishda xatolik");
    }
  }

  async function attachExistingUser() {
    if (attachUserId === "NONE") {
      toast.error("Biriktirish uchun userni tanlang");
      return;
    }
    if (!attachBranchId) {
      toast.error("Biriktirish uchun filialni tanlang");
      return;
    }

    try {
      await adminsApi.attachExistingUser({
        userId: attachUserId,
        branchId: attachBranchId,
        notes: attachNotes.trim() || undefined,
      });
      toast.success("Mavjud user admin sifatida biriktirildi");
      setOpenCreateModal(false);
      setAttachUserId("NONE");
      setAttachBranchId(getActiveBranchId() ?? branches[0]?.id ?? "");
      setAttachNotes("");
      await loadAdmins();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Biriktirishda xatolik");
    }
  }

  async function openEditAdmin(id: string) {
    try {
      const response = await adminsApi.getById(id);
      const item = toRecord(response);
      const user = toRecord(item.user);

      const role = normalizeAdminRole(asString(user.role));
      const nextStatus = (asString(item.status) || "ACTIVE") as Status;

      setEditingAdminId(id);
      setEditingInitialStatus(nextStatus);
      setEditingInitialRole(role);
      setEditDraft({
        firstName: asString(user.firstName),
        lastName: asString(user.lastName),
        phone: asString(user.phone),
        email: asString(user.email),
        password: "",
        notes: asString(item.notes),
        avatarUrl: asString(user.avatarUrl),
        branchId: asString(item.branchId) || getActiveBranchId() || branches[0]?.id || "",
        status: nextStatus,
        role,
      });
      setOpenEditModal(true);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Admin ma'lumotini olishda xatolik");
    }
  }

  async function updateAdmin() {
    if (!editingAdminId) return;

    if (!editDraft.firstName.trim() || !editDraft.lastName.trim()) {
      toast.error("Ism va familiya majburiy");
      return;
    }

    if (!editDraft.branchId) {
      toast.error("Filial tanlash majburiy");
      return;
    }

    try {
      await adminsApi.update(editingAdminId, {
        firstName: editDraft.firstName.trim(),
        lastName: editDraft.lastName.trim(),
        phone: editDraft.phone.trim() || undefined,
        email: editDraft.email.trim() || undefined,
        password: editDraft.password.trim() || undefined,
        notes: editDraft.notes.trim() || undefined,
        avatarUrl: editDraft.avatarUrl.trim() || undefined,
        branchId: editDraft.branchId,
      });

      if (editDraft.role !== editingInitialRole) {
        await adminsApi.updateRole(editingAdminId, editDraft.role);
      }

      if (editDraft.status !== editingInitialStatus) {
        await adminsApi.changeStatus(editingAdminId, editDraft.status);
      }

      toast.success("Admin yangilandi");
      setOpenEditModal(false);
      setEditingAdminId(null);
      await loadAdmins();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Yangilashda xatolik");
    }
  }

  async function softDeleteAdmin(id: string) {
    try {
      await adminsApi.remove(id);
      toast.success("Admin o'chirildi");
      await loadAdmins();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete amalga oshmadi");
    }
  }

  function openCreateAdminModal() {
    const activeBranchId = getActiveBranchId();
    const fallbackBranchId = branches[0]?.id ?? "";
    const nextBranchId =
      activeBranchId && branches.some((branch) => branch.id === activeBranchId)
        ? activeBranchId
        : fallbackBranchId;

    setDraft((prev) => ({
      ...prev,
      branchId: prev.branchId || nextBranchId,
    }));
    setAttachBranchId((prev) => prev || nextBranchId);
    setOpenCreateModal(true);
  }

  return (
    <DashboardLayout title="Adminlar" description="Admin account va role boshqaruvi">
      <PageHero
        title="Adminlar"
        subtitle="Yangi admin qo'shing yoki mavjud userni admin sifatida biriktiring"
        icon={ShieldCheck}
        statLabel="Jami adminlar"
        statValue={totalCount}
      />

      <SearchToolbar
        value={search}
        onChange={(val) => {
          setSearch(val);
        }}
        onFilter={loadAdmins}
        placeholder="Adminga oid ma'lumot (ism, email) qidiring..."
        actions={
          <>
            <Select value={status} onValueChange={(value) => setStatus(value ?? "ACTIVE")}>
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
            <Button
              variant="outline"
              className="h-11 rounded-xl border-[#e3e8f4] bg-white px-3"
              onClick={() => setViewMode((prev) => (prev === "grid" ? "list" : "grid"))}
            >
              {viewMode === "grid" ? <List className="h-4 w-4" /> : <LayoutGrid className="h-4 w-4" />}
            </Button>
            <GradientButton className="h-11 rounded-xl px-4" onClick={openCreateAdminModal}>
              <Plus className="mr-1 h-4 w-4" />
              Admin qo'shish
            </GradientButton>
          </>
        }
      />

      {!admins.length ? (
        <EmptyState
          title="Adminlar topilmadi"
          subtitle="Filterlarni tekshiring yoki yangi admin qo'shing."
          action={
            <GradientButton className="rounded-xl px-5" onClick={openCreateAdminModal}>
              <UserPlus2 className="mr-1 h-4 w-4" />
              Admin qo'shish
            </GradientButton>
          }
        />
      ) : viewMode === "grid" ? (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {admins.map((admin) => (
            <article key={admin.id} className="panel-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#2e3655]">{admin.fullName}</h3>
                <Badge variant={admin.isActive ? "secondary" : "outline"}>{admin.status}</Badge>
              </div>
              <div className="space-y-1 text-sm text-[#5f6888]">
                <p>Rol: {admin.role}</p>
                <p>Aloqa: {admin.phone ?? admin.email ?? "-"}</p>
                <p>Filial: {admin.branchName ?? "-"}</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#edf1fb] pt-3">
                <span className="text-xs text-[#8f99b7]">{formatDate(admin.createdAt)}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-700 hover:bg-[#eef2ff]"
                    onClick={() => openEditAdmin(admin.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#c7475c] hover:bg-[#fff0f3]"
                    onClick={() => softDeleteAdmin(admin.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel-surface overflow-hidden">
          <div className="grid grid-cols-[1.2fr_0.9fr_1fr_1fr_0.8fr_0.7fr] gap-3 border-b border-[#edf1fb] bg-[#f6f8fe] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f99b7]">
            <span>Admin</span>
            <span>Rol</span>
            <span>Aloqa</span>
            <span>Filial</span>
            <span>Status</span>
            <span className="text-right">Amallar</span>
          </div>
          <div className="divide-y divide-[#edf1fb]">
            {admins.map((admin) => (
              <div
                key={admin.id}
                className="grid grid-cols-[1.2fr_0.9fr_1fr_1fr_0.8fr_0.7fr] items-center gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#2f3655]">{admin.fullName}</p>
                  <p className="text-xs text-[#8f99b7]">{formatDate(admin.createdAt)}</p>
                </div>
                <span className="truncate text-[#616b8e]">{admin.role}</span>
                <span className="truncate text-[#616b8e]">{admin.phone ?? admin.email ?? "-"}</span>
                <span className="truncate text-[#616b8e]">{admin.branchName ?? "-"}</span>
                <Badge variant={admin.isActive ? "secondary" : "outline"}>{admin.status}</Badge>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-700 hover:bg-[#eef2ff]"
                    onClick={() => openEditAdmin(admin.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#c7475c] hover:bg-[#fff0f3]"
                    onClick={() => softDeleteAdmin(admin.id)}
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
        title="Yangi Admin"
        subtitle="Yangi yozuv yaratish yoki mavjud userni biriktirish"
      >
        <div className="space-y-4">
          <StepSection
            step={1}
            title="Shaxsiy ma'lumotlar"
            hint="Yangi admin uchun account ma'lumotlari"
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Ism *">
                <Input
                  className="soft-input h-11"
                  value={draft.firstName}
                  onChange={(event) => setDraft((prev) => ({ ...prev, firstName: event.target.value }))}
                  placeholder="Ism"
                />
              </Field>
              <Field label="Familiya *">
                <Input
                  className="soft-input h-11"
                  value={draft.lastName}
                  onChange={(event) => setDraft((prev) => ({ ...prev, lastName: event.target.value }))}
                  placeholder="Familiya"
                />
              </Field>
              <Field label="Telefon">
                <Input
                  className="soft-input h-11"
                  value={draft.phone}
                  onChange={(event) => setDraft((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+998 90 123 45 67"
                />
              </Field>
              <Field label="Email">
                <Input
                  className="soft-input h-11"
                  value={draft.email}
                  onChange={(event) => setDraft((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="admin@academy.uz"
                />
              </Field>
              <Field label="Filial (majburiy)">
                <Select
                  value={draft.branchId}
                  onValueChange={(value) =>
                    setDraft((prev) => ({ ...prev, branchId: value ?? "" }))
                  }
                >
                  <SelectTrigger className="soft-input h-11">
                    <SelectValue placeholder="Filialni tanlang (majburiy)" />
                  </SelectTrigger>
                  <SelectContent>
                    {!branches.length ? (
                      <SelectItem value="NO_BRANCH_AVAILABLE" disabled>
                        Filial topilmadi
                      </SelectItem>
                    ) : null}
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Parol (ixtiyoriy)">
                <Input
                  className="soft-input h-11"
                  value={draft.password}
                  onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Admin123!"
                />
              </Field>
              <Field label="Izoh">
                <Textarea
                  className="soft-input min-h-24"
                  value={draft.notes}
                  onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Mas'ul bo'lim yoki eslatma"
                />
              </Field>
            </div>
          </StepSection>

          <StepSection step={2} title="Profil rasmi" hint="Ixtiyoriy: Cloudinary upload">
            <AvatarUploadField
              value={draft.avatarUrl || undefined}
              onChange={(url) =>
                setDraft((prev) => ({
                  ...prev,
                  avatarUrl: url ?? "",
                }))
              }
              title="Admin avatarini yuklash"
              hint="Yuklangan rasm create paytida backendga yuboriladi"
            />
          </StepSection>

          <StepSection step={3} title="Mavjud userga bog'lash" hint="Yangi yaratmasdan mavjud userni admin qiling">
            <div className="space-y-3">
              <Field label="Mavjud user">
                <Select value={attachUserId} onValueChange={(value) => setAttachUserId(value ?? "NONE")}>
                  <SelectTrigger className="soft-input h-11">
                    <SelectValue placeholder="Userni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">User tanlanmagan</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Filial (majburiy)">
                <Select value={attachBranchId} onValueChange={(value) => setAttachBranchId(value ?? "") }>
                  <SelectTrigger className="soft-input h-11">
                    <SelectValue placeholder="Filialni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {!branches.length ? (
                      <SelectItem value="NO_BRANCH_AVAILABLE" disabled>
                        Filial topilmadi
                      </SelectItem>
                    ) : null}
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Biriktirish izohi">
                <Textarea
                  className="soft-input min-h-20"
                  value={attachNotes}
                  onChange={(event) => setAttachNotes(event.target.value)}
                  placeholder="Ixtiyoriy izoh"
                />
              </Field>
              <Button
                type="button"
                variant="outline"
                className="h-11 w-full rounded-xl border-[#dce3f5] bg-white text-[#4b58cf]"
                onClick={attachExistingUser}
              >
                Mavjud userni admin sifatida biriktirish
              </Button>
            </div>
          </StepSection>

          <GradientButton className="h-12 w-full rounded-xl text-base" onClick={createAdmin}>
            Admin yaratish
          </GradientButton>
        </div>
      </ModalShell>

      <ModalShell
        open={openEditModal}
        onClose={() => {
          setOpenEditModal(false);
          setEditingAdminId(null);
        }}
        title="Adminni yangilash"
        subtitle="Admin ma'lumotlarini tahrirlash"
      >
        <div className="space-y-4">
          <StepSection step={1} title="Asosiy ma'lumotlar" hint="Profil va account ma'lumotlarini tahrirlash">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Ism *">
                <Input
                  className="soft-input h-11"
                  value={editDraft.firstName}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, firstName: event.target.value }))}
                  placeholder="Ism"
                />
              </Field>
              <Field label="Familiya *">
                <Input
                  className="soft-input h-11"
                  value={editDraft.lastName}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, lastName: event.target.value }))}
                  placeholder="Familiya"
                />
              </Field>
              <Field label="Telefon">
                <Input
                  className="soft-input h-11"
                  value={editDraft.phone}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, phone: event.target.value }))}
                  placeholder="+998 90 123 45 67"
                />
              </Field>
              <Field label="Email">
                <Input
                  className="soft-input h-11"
                  value={editDraft.email}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="admin@academy.uz"
                />
              </Field>
              <Field label="Yangi parol (ixtiyoriy)">
                <Input
                  className="soft-input h-11"
                  value={editDraft.password}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Parolni o'zgartirish uchun kiriting"
                />
              </Field>
              <Field label="Filial *">
                <Select
                  value={editDraft.branchId}
                  onValueChange={(value) => setEditDraft((prev) => ({ ...prev, branchId: value ?? "" }))}
                >
                  <SelectTrigger className="soft-input h-11">
                    <SelectValue placeholder="Filialni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch.id} value={branch.id}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Role">
                <Select
                  value={editDraft.role}
                  onValueChange={(value) =>
                    setEditDraft((prev) => ({
                      ...prev,
                      role: normalizeAdminRole(value ?? "ADMIN"),
                    }))
                  }
                >
                  <SelectTrigger className="soft-input h-11">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {ADMIN_ROLE_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Status">
                <Select
                  value={editDraft.status}
                  onValueChange={(value) =>
                    setEditDraft((prev) => ({
                      ...prev,
                      status: (value ?? "ACTIVE") as Status,
                    }))
                  }
                >
                  <SelectTrigger className="soft-input h-11">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    {MUTABLE_STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Izoh" className="md:col-span-2">
                <Textarea
                  className="soft-input min-h-20"
                  value={editDraft.notes}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, notes: event.target.value }))}
                  placeholder="Ixtiyoriy izoh"
                />
              </Field>
            </div>
          </StepSection>

          <StepSection step={2} title="Profil rasmi" hint="Ixtiyoriy">
            <AvatarUploadField
              value={editDraft.avatarUrl || undefined}
              onChange={(url) =>
                setEditDraft((prev) => ({
                  ...prev,
                  avatarUrl: url ?? "",
                }))
              }
              title="Avatar"
              hint="Yangi rasm yuklasangiz update payloadga qo'shiladi"
            />
          </StepSection>

          <GradientButton className="h-12 w-full rounded-xl text-base" onClick={updateAdmin}>
            <Pencil className="mr-1 h-4 w-4" />
            Yangilash
          </GradientButton>
        </div>
      </ModalShell>
    </DashboardLayout>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={className ? `space-y-1 ${className}` : "space-y-1"}>
      <span className="text-xs font-medium text-[#7c87a9]">{label}</span>
      {children}
    </label>
  );
}
