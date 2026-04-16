"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { BookOpenCheck, Filter, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmptyState, GradientButton, ModalShell, PageHero, SearchToolbar, StepSection } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError } from "@/lib/api/client";
import { getActiveBranchId } from "@/lib/api/auth-storage";
import { coursesApi } from "@/lib/api/services";
import { Status } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils-helpers";

const STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"];

type CourseRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  price: number | null;
  durationMonth: number | null;
  status: string;
  isActive: boolean;
  createdAt: string | null;
};

const EMPTY_COURSE_DRAFT = {
  name: "",
  code: "",
  description: "",
  price: "",
  durationMonth: "",
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

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function mapCourseRow(raw: unknown): CourseRow {
  const item = toRecord(raw);
  const status = asString(item.status) || "ACTIVE";
  return {
    id: asString(item.id),
    name: asString(item.name) || "Noma'lum kurs",
    code: asNullableString(item.code),
    description: asNullableString(item.description),
    price: asNullableNumber(item.price),
    durationMonth: asNullableNumber(item.durationMonth),
    status,
    isActive: status === "ACTIVE",
    createdAt: asNullableString(item.createdAt),
  };
}

export default function CoursesPage() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ACTIVE");
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [draft, setDraft] = useState(EMPTY_COURSE_DRAFT);

  const totalCount = useMemo(() => courses.length, [courses]);

  async function loadCourses() {
    try {
      setLoading(true);
      const response = await coursesApi.list({
        page: 1,
        limit: 100,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setCourses((response.data as unknown[]).map(mapCourseRow));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Kurslar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadCourses();
  }, [status, search]);

  async function createCourse() {
    const parsedPrice = Number(draft.price);
    if (!draft.name.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0) {
      toast.error("Kurs nomi va to'g'ri narx majburiy");
      return;
    }

    try {
      await coursesApi.create({
        name: draft.name.trim(),
        code: draft.code.trim() || undefined,
        description: draft.description.trim() || undefined,
        price: parsedPrice,
        durationMonth: draft.durationMonth.trim() ? Number(draft.durationMonth) : undefined,
        branchId: getActiveBranchId() || undefined,
      });
      toast.success("Yangi kurs yaratildi");
      setOpenCreateModal(false);
      setDraft(EMPTY_COURSE_DRAFT);
      await loadCourses();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Yaratishda xatolik");
    }
  }

  async function softDeleteCourse(id: string) {
    try {
      await coursesApi.remove(id);
      toast.success("Kurs o'chirildi");
      await loadCourses();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete amalga oshmadi");
    }
  }

  return (
    <DashboardLayout title="Kurslar" description="Kurs katalogi va narx boshqaruvi">
      <PageHero
        title="Kurslar"
        subtitle="Kurslar ro'yxatini yuriting va yangi kurslar qo'shing"
        icon={BookOpenCheck}
        statLabel="Jami kurslar"
        statValue={totalCount}
      />

      <SearchToolbar
        value={search}
        onChange={setSearch}
        onFilter={loadCourses}
        placeholder="Kurslarni qidiring..."
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
            <GradientButton className="h-11 rounded-xl px-4" onClick={() => setOpenCreateModal(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Kurs qo'shish
            </GradientButton>
          </>
        }
      />

      {!courses.length ? (
        <EmptyState
          title="Kurslar topilmadi"
          subtitle="Filterlarni tekshiring yoki yangi kurs qo'shing."
          action={
            <GradientButton className="rounded-xl px-5" onClick={() => setOpenCreateModal(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Kurs qo'shish
            </GradientButton>
          }
        />
      ) : (
        <section className="panel-surface overflow-hidden">
          <div className="grid grid-cols-[1.4fr_0.9fr_1.2fr_1fr_0.7fr_0.5fr] gap-3 border-b border-[#edf1fb] bg-[#f6f8fe] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f99b7]">
            <span>Kurs</span>
            <span>Kod</span>
            <span>Narx</span>
            <span>Davomiylik</span>
            <span>Status</span>
            <span className="text-right">Amallar</span>
          </div>
          <div className="divide-y divide-[#edf1fb]">
            {courses.map((course) => (
              <div
                key={course.id}
                className="grid grid-cols-[1.4fr_0.9fr_1.2fr_1fr_0.7fr_0.5fr] items-center gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#2f3655]">{course.name}</p>
                  <p className="truncate text-xs text-[#8f99b7]">
                    {course.description ?? formatDate(course.createdAt)}
                  </p>
                </div>
                <span className="text-[#616b8e]">{course.code ?? "-"}</span>
                <span className="text-[#2f3655]">
                  {course.price !== null ? formatCurrency(course.price) : "-"}
                </span>
                <span className="text-[#616b8e]">
                  {course.durationMonth !== null ? `${course.durationMonth} oy` : "-"}
                </span>
                <Badge variant={course.isActive ? "secondary" : "outline"}>{course.status}</Badge>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#c7475c] hover:bg-[#fff0f3]"
                    onClick={() => softDeleteCourse(course.id)}
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
        title="Yangi Kurs"
        subtitle="Yangi yozuv yaratish uchun ma'lumotlarni kiriting"
      >
        <div className="space-y-4">
          <StepSection step={1} title="Kurs haqida ma'lumot" hint="Asosiy kurs parametrlari">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Kurs nomi *">
                <Input
                  className="soft-input h-11"
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Ingliz tili (IELTS)"
                />
              </Field>
              <Field label="Kurs kodi">
                <Input
                  className="soft-input h-11"
                  value={draft.code}
                  onChange={(event) => setDraft((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="ENG-IELTS"
                />
              </Field>
              <Field label="Narx *">
                <Input
                  className="soft-input h-11"
                  type="number"
                  min={1}
                  value={draft.price}
                  onChange={(event) => setDraft((prev) => ({ ...prev, price: event.target.value }))}
                  placeholder="650000"
                />
              </Field>
              <Field label="Davomiylik (oy)">
                <Input
                  className="soft-input h-11"
                  type="number"
                  min={1}
                  value={draft.durationMonth}
                  onChange={(event) =>
                    setDraft((prev) => ({ ...prev, durationMonth: event.target.value }))
                  }
                  placeholder="6"
                />
              </Field>
              <Field label="Tavsif" className="md:col-span-2">
                <Textarea
                  className="soft-input min-h-24"
                  value={draft.description}
                  onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
                  placeholder="Kurs mazmuni va natijalari haqida qisqacha..."
                />
              </Field>
            </div>
          </StepSection>

          <GradientButton className="h-12 w-full rounded-xl text-base" onClick={createCourse}>
            Kurs yaratish
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
