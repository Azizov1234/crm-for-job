"use client";
/* eslint-disable react/no-unescaped-entities */

import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  GraduationCap,
  LayoutGrid,
  List,
  Pencil,
  Plus,
  Trash2,
  UserRoundPlus,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { getActiveBranchId } from "@/lib/api/auth-storage";
import { branchesApi, teachersApi } from "@/lib/api/services";
import { Status, Teacher } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils-helpers";

const STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"];
const MUTABLE_STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED"];

type Option = { id: string; name: string };

type TeacherDraft = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  password: string;
  specialty: string;
  salary: string;
  hiredAt: string;
  bio: string;
  avatarUrl: string;
  branchId: string;
  status: Status;
};

const EMPTY_TEACHER_DRAFT: TeacherDraft = {
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
  password: "",
  specialty: "",
  salary: "",
  hiredAt: "",
  bio: "",
  avatarUrl: "",
  branchId: "",
  status: "ACTIVE",
};

export default function TeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ACTIVE");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [branches, setBranches] = useState<Option[]>([]);

  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [openEditModal, setOpenEditModal] = useState(false);
  const [editingTeacherId, setEditingTeacherId] = useState<string | null>(null);
  const [editingInitialStatus, setEditingInitialStatus] = useState<Status>("ACTIVE");

  const [draft, setDraft] = useState<TeacherDraft>(EMPTY_TEACHER_DRAFT);
  const [editDraft, setEditDraft] = useState<TeacherDraft>(EMPTY_TEACHER_DRAFT);

  const totalCount = useMemo(() => teachers.length, [teachers]);

  async function loadTeachers() {
    try {
      const response = await teachersApi.list({
        page: 1,
        limit: 100,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setTeachers(response.data);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "O'qituvchilar yuklanmadi");
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
        (activeBranchId && options.some((item) => item.id === activeBranchId)
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
      void loadTeachers();
    }, 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status]);

  useEffect(() => {
    void loadBranches();
  }, []);

  async function createTeacher() {
    if (!draft.firstName.trim() || !draft.lastName.trim()) {
      toast.error("Ism va familiya majburiy");
      return;
    }

    if (!draft.branchId) {
      toast.error("Filialni tanlang");
      return;
    }

    try {
      await teachersApi.create({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        phone: draft.phone.trim() || undefined,
        email: draft.email.trim() || undefined,
        password: draft.password.trim() || undefined,
        specialty: draft.specialty.trim() || undefined,
        salary: draft.salary ? Number(draft.salary) : undefined,
        hiredAt: draft.hiredAt || undefined,
        bio: draft.bio.trim() || undefined,
        avatarUrl: draft.avatarUrl.trim() || undefined,
        branchId: draft.branchId,
      });

      toast.success("Yangi o'qituvchi qo'shildi");
      setOpenCreateModal(false);
      setDraft({
        ...EMPTY_TEACHER_DRAFT,
        branchId: getActiveBranchId() ?? branches[0]?.id ?? "",
      });
      await loadTeachers();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Yaratishda xatolik");
    }
  }

  async function openEditTeacher(id: string) {
    try {
      const response = await teachersApi.getById(id);
      const user = (response.user ?? {}) as Record<string, unknown>;
      const statusValue = (String(response.status ?? "ACTIVE") as Status) ?? "ACTIVE";

      setEditingTeacherId(id);
      setEditingInitialStatus(statusValue);
      setEditDraft({
        firstName: String(user.firstName ?? ""),
        lastName: String(user.lastName ?? ""),
        phone: String(user.phone ?? ""),
        email: String(user.email ?? ""),
        password: "",
        specialty: String(response.specialty ?? ""),
        salary: response.salary !== undefined && response.salary !== null ? String(response.salary) : "",
        hiredAt: String(response.hiredAt ?? "").slice(0, 10),
        bio: String(response.bio ?? ""),
        avatarUrl: String(user.avatarUrl ?? ""),
        branchId: String(response.branchId ?? getActiveBranchId() ?? branches[0]?.id ?? ""),
        status: statusValue,
      });
      setOpenEditModal(true);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Ma'lumotni olishda xatolik");
    }
  }

  async function updateTeacher() {
    if (!editingTeacherId) return;

    if (!editDraft.firstName.trim() || !editDraft.lastName.trim()) {
      toast.error("Ism va familiya majburiy");
      return;
    }

    if (!editDraft.branchId) {
      toast.error("Filialni tanlang");
      return;
    }

    try {
      await teachersApi.update(editingTeacherId, {
        firstName: editDraft.firstName.trim(),
        lastName: editDraft.lastName.trim(),
        phone: editDraft.phone.trim() || undefined,
        email: editDraft.email.trim() || undefined,
        password: editDraft.password.trim() || undefined,
        specialty: editDraft.specialty.trim() || undefined,
        salary: editDraft.salary ? Number(editDraft.salary) : undefined,
        hiredAt: editDraft.hiredAt || undefined,
        bio: editDraft.bio.trim() || undefined,
        avatarUrl: editDraft.avatarUrl.trim() || undefined,
        branchId: editDraft.branchId,
      });

      if (editDraft.status !== editingInitialStatus) {
        await teachersApi.changeStatus(editingTeacherId, editDraft.status);
      }

      toast.success("O'qituvchi yangilandi");
      setOpenEditModal(false);
      setEditingTeacherId(null);
      await loadTeachers();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Yangilashda xatolik");
    }
  }

  async function softDeleteTeacher(id: string) {
    try {
      await teachersApi.remove(id);
      toast.success("O'qituvchi o'chirildi");
      await loadTeachers();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete amalga oshmadi");
    }
  }

  function openCreateTeacherModal() {
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
    setOpenCreateModal(true);
  }

  return (
    <DashboardLayout title="O'qituvchilar" description="Teacher profile va account boshqaruvi">
      <PageHero
        title="O'qituvchilar"
        subtitle="O'qituvchilar ro'yxatini yuriting va yangi o'qituvchi qo'shing"
        icon={GraduationCap}
        statLabel="Jami o'qituvchilar"
        statValue={totalCount}
      />

      <SearchToolbar
        value={search}
        onChange={setSearch}
        onFilter={loadTeachers}
        placeholder="O'qituvchilarni qidiring..."
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
            <GradientButton className="h-11 rounded-xl px-4" onClick={openCreateTeacherModal}>
              <Plus className="mr-1 h-4 w-4" />
              O'qituvchi qo'shish
            </GradientButton>
          </>
        }
      />

      {teachers.length === 0 ? (
        <EmptyState
          title="O'qituvchilar topilmadi"
          subtitle="Filterlarni tekshiring yoki yangi o'qituvchi qo'shing."
          action={
            <GradientButton className="rounded-xl px-5" onClick={openCreateTeacherModal}>
              <UserRoundPlus className="mr-1 h-4 w-4" />
              O'qituvchi qo'shish
            </GradientButton>
          }
        />
      ) : viewMode === "grid" ? (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teachers.map((teacher) => (
            <article key={teacher.id} className="panel-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#2e3655]">{teacher.name}</h3>
                <Badge variant={teacher.isActive ? "secondary" : "outline"}>{teacher.status}</Badge>
              </div>
              <div className="space-y-1 text-sm text-[#5f6888]">
                <p>Telefon: {teacher.phone ?? "-"}</p>
                <p>Email: {teacher.email ?? "-"}</p>
                <p>Mutaxassislik: {teacher.specialty ?? "-"}</p>
                <p>Maosh: {teacher.salary ? formatCurrency(teacher.salary) : "-"}</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#edf1fb] pt-3">
                <span className="text-xs text-[#8f99b7]">{formatDate(teacher.createdAt)}</span>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-700 hover:bg-[#eef2ff]"
                    onClick={() => openEditTeacher(teacher.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#c7475c] hover:bg-[#fff0f3]"
                    onClick={() => softDeleteTeacher(teacher.id)}
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
          <div className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr_0.7fr] gap-3 border-b border-[#edf1fb] bg-[#f6f8fe] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f99b7]">
            <span>O'qituvchi</span>
            <span>Aloqa</span>
            <span>Mutaxassislik</span>
            <span>Maosh</span>
            <span>Status</span>
            <span className="text-right">Amallar</span>
          </div>
          <div className="divide-y divide-[#edf1fb]">
            {teachers.map((teacher) => (
              <div
                key={teacher.id}
                className="grid grid-cols-[1.4fr_1fr_1fr_1fr_0.9fr_0.7fr] items-center gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#2f3655]">{teacher.name}</p>
                  <p className="text-xs text-[#8f99b7]">{formatDate(teacher.createdAt)}</p>
                </div>
                <span className="truncate text-[#616b8e]">{teacher.phone ?? teacher.email ?? "-"}</span>
                <span className="truncate text-[#616b8e]">{teacher.specialty ?? "-"}</span>
                <span className="text-[#2f3655]">
                  {teacher.salary ? formatCurrency(teacher.salary) : "-"}
                </span>
                <Badge variant={teacher.isActive ? "secondary" : "outline"}>{teacher.status}</Badge>
                <div className="flex justify-end gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-700 hover:bg-[#eef2ff]"
                    onClick={() => openEditTeacher(teacher.id)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#c7475c] hover:bg-[#fff0f3]"
                    onClick={() => softDeleteTeacher(teacher.id)}
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
        title="Yangi O'qituvchi"
        subtitle="Yangi yozuv yaratish uchun ma'lumotlarni kiriting"
      >
        <div className="space-y-4">
          <StepSection
            step={1}
            title="Shaxsiy ma'lumotlar"
            hint="O'qituvchi uchun asosiy account va profil ma'lumotlari"
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
              <Field label="Telefon raqami">
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
                  placeholder="teacher@academy.uz"
                />
              </Field>
              <Field label="Parol (ixtiyoriy)">
                <Input
                  className="soft-input h-11"
                  value={draft.password}
                  onChange={(event) => setDraft((prev) => ({ ...prev, password: event.target.value }))}
                  placeholder="Teacher123!"
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
              <Field label="Mutaxassislik">
                <Input
                  className="soft-input h-11"
                  value={draft.specialty}
                  onChange={(event) => setDraft((prev) => ({ ...prev, specialty: event.target.value }))}
                  placeholder="Matematika"
                />
              </Field>
              <Field label="Maosh">
                <Input
                  className="soft-input h-11"
                  type="number"
                  value={draft.salary}
                  onChange={(event) => setDraft((prev) => ({ ...prev, salary: event.target.value }))}
                  placeholder="4500000"
                />
              </Field>
              <Field label="Ishga olingan sana">
                <div className="relative">
                  <Input
                    className="soft-input h-11 pr-10"
                    type="date"
                    value={draft.hiredAt}
                    onChange={(event) => setDraft((prev) => ({ ...prev, hiredAt: event.target.value }))}
                  />
                  <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa4c0]" />
                </div>
              </Field>
              <Field label="Bio" className="md:col-span-2">
                <Textarea
                  className="soft-input min-h-24"
                  value={draft.bio}
                  onChange={(event) => setDraft((prev) => ({ ...prev, bio: event.target.value }))}
                  placeholder="Qisqa izoh"
                />
              </Field>
            </div>
          </StepSection>

          <StepSection step={2} title="Profil rasmi" hint="Cloudinary orqali rasm yuklash">
            <AvatarUploadField
              value={draft.avatarUrl || undefined}
              onChange={(url) =>
                setDraft((prev) => ({
                  ...prev,
                  avatarUrl: url ?? "",
                }))
              }
              title="Profil rasmini qo'shish"
              hint="Ixtiyoriy, lekin create paytida ham yuboriladi"
            />
          </StepSection>

          <GradientButton className="h-12 w-full rounded-xl text-base" onClick={createTeacher}>
            O'qituvchi yaratish
          </GradientButton>
        </div>
      </ModalShell>

      <ModalShell
        open={openEditModal}
        onClose={() => {
          setOpenEditModal(false);
          setEditingTeacherId(null);
        }}
        title="O'qituvchini yangilash"
        subtitle="Mavjud yozuvni tahrirlash"
      >
        <div className="space-y-4">
          <StepSection step={1} title="Asosiy ma'lumotlar" hint="Profil va statusni tahrirlash">
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
                  placeholder="teacher@academy.uz"
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
              <Field label="Mutaxassislik">
                <Input
                  className="soft-input h-11"
                  value={editDraft.specialty}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, specialty: event.target.value }))}
                  placeholder="Mutaxassislik"
                />
              </Field>
              <Field label="Maosh">
                <Input
                  className="soft-input h-11"
                  type="number"
                  value={editDraft.salary}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, salary: event.target.value }))}
                  placeholder="4500000"
                />
              </Field>
              <Field label="Ishga olingan sana">
                <div className="relative">
                  <Input
                    className="soft-input h-11 pr-10"
                    type="date"
                    value={editDraft.hiredAt}
                    onChange={(event) => setEditDraft((prev) => ({ ...prev, hiredAt: event.target.value }))}
                  />
                  <CalendarDays className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9aa4c0]" />
                </div>
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
              <Field label="Bio" className="md:col-span-2">
                <Textarea
                  className="soft-input min-h-24"
                  value={editDraft.bio}
                  onChange={(event) => setEditDraft((prev) => ({ ...prev, bio: event.target.value }))}
                  placeholder="Qisqa izoh"
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
              title="Profil rasmini yangilash"
              hint="Yangi rasm update payloadga qo'shiladi"
            />
          </StepSection>

          <GradientButton className="h-12 w-full rounded-xl text-base" onClick={updateTeacher}>
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
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={className ? `space-y-1 ${className}` : "space-y-1"}>
      <span className="text-xs font-medium text-[#7c87a9]">{label}</span>
      {children}
    </label>
  );
}
