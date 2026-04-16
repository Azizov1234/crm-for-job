"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { LayoutGrid, List, Pencil, Plus, Trash2, UserRoundPlus, Users2 } from "lucide-react";
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
import { branchesApi, parentsApi, studentsApi } from "@/lib/api/services";
import { Status } from "@/lib/types";
import { formatDate } from "@/lib/utils-helpers";

const STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"];
const MUTABLE_STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED"];

type ParentRow = {
  id: string;
  fullName: string;
  phone: string | null;
  email: string | null;
  occupation: string | null;
  address: string | null;
  studentCount: number;
  status: string;
  isActive: boolean;
  branchId: string | null;
  createdAt: string | null;
};

type Option = { id: string; name: string };

type ParentDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  occupation: string;
  address: string;
  avatarUrl: string;
  branchId: string;
  status: Status;
  studentIds: string[];
};

const EMPTY_PARENT_DRAFT: ParentDraft = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  password: "",
  occupation: "",
  address: "",
  avatarUrl: "",
  branchId: "",
  status: "ACTIVE",
  studentIds: [],
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

function asNumber(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function mapParentRow(raw: unknown): ParentRow {
  const item = toRecord(raw);
  const user = toRecord(item.user);
  const countInfo = toRecord(item._count);
  const firstName = asString(user.firstName).trim();
  const lastName = asString(user.lastName).trim();
  const fullName = `${firstName} ${lastName}`.trim();
  const status = asString(item.status) || "ACTIVE";

  return {
    id: asString(item.id),
    fullName: fullName || "Noma'lum",
    phone: asNullableString(user.phone),
    email: asNullableString(user.email),
    occupation: asNullableString(item.occupation),
    address: asNullableString(item.address),
    studentCount: asNumber(countInfo.studentLinks ?? 0),
    status,
    isActive: status === "ACTIVE",
    branchId: asNullableString(item.branchId),
    createdAt: asNullableString(item.createdAt),
  };
}

export default function ParentsPage() {
  const [parents, setParents] = useState<ParentRow[]>([]);
  const [students, setStudents] = useState<Option[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ACTIVE");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [editingInitialStatus, setEditingInitialStatus] = useState<Status>("ACTIVE");
  const [editingInitialDraft, setEditingInitialDraft] = useState<ParentDraft | null>(null);
  const [draft, setDraft] = useState<ParentDraft>(EMPTY_PARENT_DRAFT);
  const [editDraft, setEditDraft] = useState<ParentDraft>(EMPTY_PARENT_DRAFT);

  const totalCount = useMemo(() => parents.length, [parents]);
  const editableStatusOptions = useMemo<Status[]>(() => {
    if (
      editingInitialStatus &&
      !MUTABLE_STATUS_OPTIONS.includes(editingInitialStatus)
    ) {
      return [...MUTABLE_STATUS_OPTIONS, editingInitialStatus];
    }

    return MUTABLE_STATUS_OPTIONS;
  }, [editingInitialStatus]);

  async function loadParents() {
    try {
      const response = await parentsApi.list({
        page: 1,
        limit: 100,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setParents((response.data as unknown[]).map(mapParentRow));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Ota-onalar yuklanmadi");
    }
  }

  async function loadStudents() {
    try {
      const response = await studentsApi.selectOptions();
      setStudents(response.map((item) => ({ id: item.id, name: item.name })));
    } catch {
      setStudents([]);
    }
  }

  async function loadBranches() {
    try {
      const response = await branchesApi.list({ page: 1, limit: 200, status: "ACTIVE" });
      const options = (response.data as Array<{ id: string; name: string }>).map((item) => ({
        id: item.id,
        name: item.name,
      }));

      const activeBranchId = getActiveBranchId();
      const defaultBranchId =
        (activeBranchId && options.some((branch) => branch.id === activeBranchId)
          ? activeBranchId
          : options[0]?.id) ?? "";

      setBranches(options);
      setDraft((prev) => ({ ...prev, branchId: prev.branchId || defaultBranchId }));
      setEditDraft((prev) => ({ ...prev, branchId: prev.branchId || defaultBranchId }));
    } catch {
      setBranches([]);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void loadParents();
    }, 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  useEffect(() => {
    void loadStudents();
    void loadBranches();
  }, []);

  function toggleStudent(stateSetter: "draft" | "editDraft", id: string) {
    if (stateSetter === "draft") {
      setDraft((prev) => ({
        ...prev,
        studentIds: prev.studentIds.includes(id)
          ? prev.studentIds.filter((current) => current !== id)
          : [...prev.studentIds, id],
      }));
      return;
    }

    setEditDraft((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(id)
        ? prev.studentIds.filter((current) => current !== id)
        : [...prev.studentIds, id],
    }));
  }

  async function createParent() {
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      toast.error("Ism va familiya majburiy");
      return;
    }

    if (!draft.branchId) {
      toast.error("Filialni tanlang");
      return;
    }

    try {
      await parentsApi.create({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim() || undefined,
        password: draft.password.trim() || undefined,
        occupation: draft.occupation.trim() || undefined,
        address: draft.address.trim() || undefined,
        avatarUrl: draft.avatarUrl.trim() || undefined,
        branchId: draft.branchId,
        studentIds: draft.studentIds.length ? draft.studentIds : undefined,
      });
      toast.success("Yangi ota-ona yaratildi");
      setOpenCreateModal(false);
      setDraft({
        ...EMPTY_PARENT_DRAFT,
        branchId: getActiveBranchId() ?? branches[0]?.id ?? "",
      });
      await loadParents();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Yaratishda xatolik");
    }
  }

  async function openEditParent(id: string) {
    try {
      const response = await parentsApi.getById(id);
      const user = (response.user ?? {}) as Record<string, unknown>;
      const linkedStudents = Array.isArray(response.studentLinks)
        ? response.studentLinks
            .map((link: unknown) =>
              String((link as Record<string, unknown>).studentId ?? ""),
            )
            .filter(Boolean)
        : [];

      const statusValue = (String(response.status ?? "ACTIVE") as Status) ?? "ACTIVE";

      const nextDraft: ParentDraft = {
        firstName: String(user.firstName ?? ""),
        lastName: String(user.lastName ?? ""),
        phone: String(user.phone ?? ""),
        email: String(user.email ?? ""),
        password: "",
        occupation: String(response.occupation ?? ""),
        address: String(response.address ?? ""),
        avatarUrl: String(user.avatarUrl ?? ""),
        branchId: String(response.branchId ?? getActiveBranchId() ?? branches[0]?.id ?? ""),
        status: statusValue,
        studentIds: linkedStudents,
      };

      setEditingParentId(id);
      setEditingInitialStatus(statusValue);
      setEditingInitialDraft(nextDraft);
      setEditDraft(nextDraft);
      setOpenEditModal(true);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Ota-ona ma'lumotini olishda xatolik");
    }
  }

  async function updateParent() {
    if (!editingParentId) return;
    if (!editingInitialDraft) return;

    if (!editDraft.firstName.trim() || !editDraft.lastName.trim()) {
      toast.error("Ism va familiya majburiy");
      return;
    }

    if (!editDraft.branchId) {
      toast.error("Filialni tanlang");
      return;
    }

    try {
      const profilePayload: Record<string, unknown> = {};
      const firstName = editDraft.firstName.trim();
      const lastName = editDraft.lastName.trim();
      const phone = editDraft.phone.trim();
      const email = editDraft.email.trim();
      const occupation = editDraft.occupation.trim();
      const address = editDraft.address.trim();
      const avatarUrl = editDraft.avatarUrl.trim();

      if (firstName !== editingInitialDraft.firstName.trim()) profilePayload.firstName = firstName;
      if (lastName !== editingInitialDraft.lastName.trim()) profilePayload.lastName = lastName;
      if (phone !== editingInitialDraft.phone.trim()) profilePayload.phone = phone || undefined;
      if (email !== editingInitialDraft.email.trim()) profilePayload.email = email || undefined;
      if (occupation !== editingInitialDraft.occupation.trim()) profilePayload.occupation = occupation || undefined;
      if (address !== editingInitialDraft.address.trim()) profilePayload.address = address || undefined;
      if (avatarUrl !== editingInitialDraft.avatarUrl.trim()) profilePayload.avatarUrl = avatarUrl || undefined;
      if (editDraft.branchId !== editingInitialDraft.branchId) profilePayload.branchId = editDraft.branchId;
      if (editDraft.password.trim()) profilePayload.password = editDraft.password.trim();

      const hasProfileChanges = Object.keys(profilePayload).length > 0;
      const hasStatusChanges = editDraft.status !== editingInitialStatus;

      if (!hasProfileChanges && !hasStatusChanges) {
        toast.info("O'zgarish topilmadi");
        return;
      }

      if (hasProfileChanges) {
        await parentsApi.update(editingParentId, profilePayload);
      }

      if (hasStatusChanges) {
        await parentsApi.changeStatus(editingParentId, editDraft.status);
      }

      if (editDraft.studentIds.length) {
        await parentsApi.assignStudent(editingParentId, editDraft.studentIds);
      }

      toast.success("Ota-ona yangilandi");
      setOpenEditModal(false);
      setEditingParentId(null);
      setEditingInitialDraft(null);
      await loadParents();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Yangilashda xatolik");
    }
  }

  async function softDeleteParent(id: string) {
    try {
      await parentsApi.remove(id);
      toast.success("Ota-ona o'chirildi");
      await loadParents();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete amalga oshmadi");
    }
  }

  return (
    <DashboardLayout title="Ota-onalar" description="Parent profile va o'quvchi biriktirish boshqaruvi">
      <PageHero
        title="Ota-onalar"
        subtitle="Vasiy ma'lumotlarini saqlang va o'quvchilarni biriktiring"
        icon={Users2}
        statLabel="Jami ota-onalar"
        statValue={totalCount}
      />

      <SearchToolbar
        value={search}
        onChange={setSearch}
        onFilter={loadParents}
        placeholder="Ota-onalarni qidiring..."
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
            <GradientButton className="h-11 rounded-xl px-4" onClick={() => setOpenCreateModal(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Ota-ona qo'shish
            </GradientButton>
          </>
        }
      />

      {!parents.length ? (
        <EmptyState
          title="Ota-onalar topilmadi"
          subtitle="Filterlarni tekshiring yoki yangi ota-ona qo'shing."
          action={
            <GradientButton className="rounded-xl px-5" onClick={() => setOpenCreateModal(true)}>
              <UserRoundPlus className="mr-1 h-4 w-4" />
              Ota-ona qo'shish
            </GradientButton>
          }
        />
      ) : viewMode === "grid" ? (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {parents.map((parent) => (
            <article key={parent.id} className="panel-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#2e3655]">{parent.fullName}</h3>
                <Badge variant={parent.isActive ? "secondary" : "outline"}>{parent.status}</Badge>
              </div>
              <div className="space-y-1 text-sm text-[#5f6888]">
                <p>Aloqa: {parent.phone ?? parent.email ?? "-"}</p>
                <p>Kasbi: {parent.occupation ?? "-"}</p>
                <p>O'quvchi soni: {parent.studentCount}</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#edf1fb] pt-3">
                <span className="text-xs text-[#8f99b7]">{formatDate(parent.createdAt)}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-700 hover:bg-[#eef2ff]"
                    onClick={() => openEditParent(parent.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#c7475c] hover:bg-[#fff0f3]"
                    onClick={() => softDeleteParent(parent.id)}
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
          <div className="grid grid-cols-[1.2fr_1fr_1fr_1fr_0.8fr_0.7fr] gap-3 border-b border-[#edf1fb] bg-[#f6f8fe] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f99b7]">
            <span>Ota-ona</span>
            <span>Aloqa</span>
            <span>Kasbi</span>
            <span>O'quvchi</span>
            <span>Status</span>
            <span className="text-right">Amallar</span>
          </div>
          <div className="divide-y divide-[#edf1fb]">
            {parents.map((parent) => (
              <div
                key={parent.id}
                className="grid grid-cols-[1.2fr_1fr_1fr_1fr_0.8fr_0.7fr] items-center gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#2f3655]">{parent.fullName}</p>
                  <p className="text-xs text-[#8f99b7]">{formatDate(parent.createdAt)}</p>
                </div>
                <span className="truncate text-[#616b8e]">{parent.phone ?? parent.email ?? "-"}</span>
                <span className="truncate text-[#616b8e]">{parent.occupation ?? "-"}</span>
                <span className="text-[#616b8e]">{parent.studentCount}</span>
                <Badge variant={parent.isActive ? "secondary" : "outline"}>{parent.status}</Badge>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-700 hover:bg-[#eef2ff]"
                    onClick={() => openEditParent(parent.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#c7475c] hover:bg-[#fff0f3]"
                    onClick={() => softDeleteParent(parent.id)}
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
        title="Yangi Ota-ona"
        subtitle="Yangi yozuv yaratish uchun ma'lumotlarni kiriting"
      >
        <div className="space-y-4">
          <StepSection
            step={1}
            title="Ota-ona / vasiy ma'lumotlari"
            hint="Asosiy account va profil ma'lumotlari"
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
                  placeholder="parent@academy.uz"
                />
              </Field>
              <Field label="Parol (ixtiyoriy)">
                <Input
                  className="soft-input h-11"
                  value={draft.password}
                  onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Parent123!"
                />
              </Field>
              <Field label="Filial *">
                <Select
                  value={draft.branchId}
                  onValueChange={(value) => setDraft((prev) => ({ ...prev, branchId: value ?? "" }))}
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
              <Field label="Kasbi">
                <Input
                  className="soft-input h-11"
                  value={draft.occupation}
                  onChange={(event) => setDraft((prev) => ({ ...prev, occupation: event.target.value }))}
                  placeholder="Muhandis"
                />
              </Field>
              <Field label="Manzil" className="md:col-span-2">
                <Textarea
                  className="soft-input min-h-24"
                  value={draft.address}
                  onChange={(event) => setDraft((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Toshkent shahri..."
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
              title="Vasiy avatarini yuklash"
              hint="Rasm yuklangandan so'ng avtomatik avatarUrl saqlanadi"
            />
          </StepSection>

          <StepSection
            step={3}
            title="O'quvchini biriktirish"
            hint="Ixtiyoriy: hozir yoki keyinroq biriktirishingiz mumkin"
          >
            <MultiSelectPanel
              options={students}
              selected={draft.studentIds}
              onToggle={(id) => toggleStudent("draft", id)}
              emptyLabel="Biriktirish uchun aktiv o'quvchilar topilmadi"
            />
          </StepSection>

          <GradientButton className="h-12 w-full rounded-xl text-base" onClick={createParent}>
            Ota-ona yaratish
          </GradientButton>
        </div>
      </ModalShell>

      <ModalShell
        open={openEditModal}
        onClose={() => {
          setOpenEditModal(false);
          setEditingParentId(null);
          setEditingInitialDraft(null);
        }}
        title="Ota-onani yangilash"
        subtitle="Profil va statusni tahrirlash"
      >
        <div className="space-y-4">
          <StepSection step={1} title="Asosiy ma'lumotlar" hint="Vasiy ma'lumotlarini yangilash">
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
                  placeholder="parent@academy.uz"
                />
              </Field>
              <Field label="Yangi parol (ixtiyoriy)">
                <Input
                  className="soft-input h-11"
                  value={editDraft.password}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Parolni o'zgartirish uchun"
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
              <Field label="Kasbi">
                <Input
                  className="soft-input h-11"
                  value={editDraft.occupation}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, occupation: event.target.value }))}
                  placeholder="Kasbi"
                />
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
                    {editableStatusOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Manzil" className="md:col-span-2">
                <Textarea
                  className="soft-input min-h-24"
                  value={editDraft.address}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, address: event.target.value }))}
                  placeholder="Manzil"
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
              title="Avatarni yangilash"
              hint="Yangi rasm update payloadga yuboriladi"
            />
          </StepSection>

          <StepSection step={3} title="O'quvchi biriktirish" hint="Mavjud biriktirishlar ustiga qo'shiladi">
            <MultiSelectPanel
              options={students}
              selected={editDraft.studentIds}
              onToggle={(id) => toggleStudent("editDraft", id)}
              emptyLabel="Aktiv o'quvchilar topilmadi"
            />
          </StepSection>

          <GradientButton className="h-12 w-full rounded-xl text-base" onClick={updateParent}>
            <Pencil className="mr-1 h-4 w-4" />
            Yangilash
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

function MultiSelectPanel({
  options,
  selected,
  onToggle,
  emptyLabel,
}: {
  options: Option[];
  selected: string[];
  onToggle: (id: string) => void;
  emptyLabel: string;
}) {
  if (!options.length) {
    return (
      <div className="rounded-xl border border-[#e7ecf8] bg-[#fbfcff] px-3 py-2 text-sm text-[#8f99b7]">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => {
        const active = selected.includes(option.id);
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onToggle(option.id)}
            className={`rounded-xl border px-3 py-1.5 text-sm transition ${
              active
                ? "border-[#5b60e4] bg-[#eef0ff] text-[#3f49c8]"
                : "border-[#dce3f5] bg-white text-[#677298] hover:border-[#b6c1e5]"
            }`}
          >
            {option.name}
          </button>
        );
      })}
    </div>
  );
}
