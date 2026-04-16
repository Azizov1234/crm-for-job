"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { Filter, LayoutGrid, List, Plus, School, Trash2, Users } from "lucide-react";
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
import { ApiError } from "@/lib/api/client";
import { coursesApi, groupsApi, roomsApi, studentsApi, teachersApi } from "@/lib/api/services";
import { CourseOption, Group, Status } from "@/lib/types";
import { formatCurrency, formatDate } from "@/lib/utils-helpers";

type Option = { id: string; name: string };

const STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"];

export default function GroupsPage() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [teachers, setTeachers] = useState<Option[]>([]);
  const [rooms, setRooms] = useState<Option[]>([]);
  const [students, setStudents] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ACTIVE");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    courseId: "",
    roomId: "",
    teacherId: "",
    capacity: "20",
    price: "",
    studentIds: [] as string[],
  });

  const totalCount = useMemo(() => groups.length, [groups]);

  async function loadGroups() {
    try {
      setLoading(true);
      const response = await groupsApi.list({
        page: 1,
        limit: 100,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setGroups(response.data);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Guruhlar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  async function loadOptions() {
    try {
      const [coursesRes, teachersRes, roomsRes, studentsRes] = await Promise.all([
        coursesApi.list({ page: 1, limit: 100, status: "ACTIVE" }),
        teachersApi.selectOptions(),
        roomsApi.list({ page: 1, limit: 100, status: "ACTIVE" }),
        studentsApi.selectOptions(),
      ]);

      setCourses(coursesRes.data);
      setTeachers(teachersRes);
      setRooms((roomsRes.data as Array<{ id: string; name: string }>).map((x) => ({ id: x.id, name: x.name })));
      setStudents(studentsRes);
    } catch {
      setCourses([]);
      setTeachers([]);
      setRooms([]);
      setStudents([]);
    }
  }

  useEffect(() => {
    void loadGroups();
  }, [status, search]);

  useEffect(() => {
    void loadOptions();
  }, []);

  async function createGroup() {
    if (!draft.name.trim() || !draft.courseId) {
      toast.error("Guruh nomi va kurs majburiy");
      return;
    }

    try {
      await groupsApi.create({
        name: draft.name.trim(),
        courseId: draft.courseId,
        roomId: draft.roomId || undefined,
        teacherId: draft.teacherId || undefined,
        capacity: Number(draft.capacity) || 1,
        price: draft.price ? Number(draft.price) : undefined,
        studentIds: draft.studentIds.length ? draft.studentIds : undefined,
      });
      toast.success("Yangi guruh yaratildi");
      setOpenCreateModal(false);
      setDraft({
        name: "",
        courseId: "",
        roomId: "",
        teacherId: "",
        capacity: "20",
        price: "",
        studentIds: [],
      });
      await loadGroups();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Yaratishda xatolik");
    }
  }

  async function softDeleteGroup(id: string) {
    try {
      await groupsApi.remove(id);
      toast.success("Guruh o'chirildi");
      await loadGroups();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete amalga oshmadi");
    }
  }

  return (
    <DashboardLayout title="Guruhlar" description="Kurslar, xonalar va a'zolar bilan guruh boshqaruvi">
      <PageHero
        title="Guruhlar"
        subtitle="Yangi guruhlar oching va dars jarayonini boshqaring"
        icon={School}
        statLabel="Jami guruhlar"
        statValue={totalCount}
      />

      <SearchToolbar
        value={search}
        onChange={setSearch}
        onFilter={loadGroups}
        placeholder="Guruhlarni qidiring..."
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
              Guruh qo'shish
            </GradientButton>
          </>
        }
      />

      {!groups.length ? (
        <EmptyState
          title="Guruhlar topilmadi"
          subtitle="Filterlarni tekshiring yoki yangi guruh yarating."
          action={
            <GradientButton className="rounded-xl px-5" onClick={() => setOpenCreateModal(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Guruh qo'shish
            </GradientButton>
          }
        />
      ) : viewMode === "grid" ? (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {groups.map((group) => (
            <article key={group.id} className="panel-surface p-4">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="text-base font-semibold text-[#2e3655]">{group.name}</h3>
                <Badge variant={group.isActive ? "secondary" : "outline"}>{group.status}</Badge>
              </div>
              <div className="space-y-1 text-sm text-[#5f6888]">
                <p>Kurs: {group.course?.name ?? "-"}</p>
                <p>O'qituvchi: {group.teacher?.fullName ?? "-"}</p>
                <p>Sig'im: {group.capacity}</p>
                <p>Narx: {group.price ? formatCurrency(group.price) : "-"}</p>
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-[#edf1fb] pt-3">
                <span className="text-xs text-[#8f99b7]">{formatDate(group.createdAt)}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-[#c7475c] hover:bg-[#fff0f3]"
                  onClick={() => softDeleteGroup(group.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className="panel-surface overflow-hidden">
          <div className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr_1fr_0.8fr_0.5fr] gap-3 border-b border-[#edf1fb] bg-[#f6f8fe] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f99b7]">
            <span>Guruh</span>
            <span>Kurs</span>
            <span>O'qituvchi</span>
            <span>Sig'im</span>
            <span>Narx</span>
            <span>Status</span>
            <span className="text-right">Amallar</span>
          </div>
          <div className="divide-y divide-[#edf1fb]">
            {groups.map((group) => (
              <div
                key={group.id}
                className="grid grid-cols-[1.3fr_1fr_1fr_0.8fr_1fr_0.8fr_0.5fr] items-center gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#2f3655]">{group.name}</p>
                  <p className="text-xs text-[#8f99b7]">{formatDate(group.createdAt)}</p>
                </div>
                <span className="truncate text-[#616b8e]">{group.course?.name ?? "-"}</span>
                <span className="truncate text-[#616b8e]">{group.teacher?.fullName ?? "-"}</span>
                <span className="text-[#616b8e]">{group.capacity}</span>
                <span className="text-[#2f3655]">{group.price ? formatCurrency(group.price) : "-"}</span>
                <Badge variant={group.isActive ? "secondary" : "outline"}>{group.status}</Badge>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#c7475c] hover:bg-[#fff0f3]"
                    onClick={() => softDeleteGroup(group.id)}
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
        title="Yangi Guruh"
        subtitle="Yangi yozuv yaratish uchun ma'lumotlarni kiriting"
      >
        <div className="space-y-4">
          <StepSection step={1} title="Guruh tafsilotlari" hint="Asosiy guruh parametrlari">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Guruh nomi *">
                <Input
                  className="soft-input h-11"
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Masalan, Matematika A"
                />
              </Field>
              <Field label="Kurs *">
                <Select
                  value={draft.courseId || "NONE"}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      courseId: (value ?? "NONE") === "NONE" ? "" : (value ?? ""),
                    }))
                  }
                >
                  <SelectTrigger className="soft-input h-11">
                    <SelectValue placeholder="Kursni tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Kurs tanlang</SelectItem>
                    {courses.map((course) => (
                      <SelectItem key={course.id} value={course.id}>
                        {course.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Xona">
                <Select
                  value={draft.roomId || "NONE"}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      roomId: (value ?? "NONE") === "NONE" ? "" : (value ?? ""),
                    }))
                  }
                >
                  <SelectTrigger className="soft-input h-11">
                    <SelectValue placeholder="Xonani tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">Xona tanlanmagan</SelectItem>
                    {rooms.map((room) => (
                      <SelectItem key={room.id} value={room.id}>
                        {room.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="O'qituvchi">
                <Select
                  value={draft.teacherId || "NONE"}
                  onValueChange={(value) =>
                    setDraft((prev) => ({
                      ...prev,
                      teacherId: (value ?? "NONE") === "NONE" ? "" : (value ?? ""),
                    }))
                  }
                >
                  <SelectTrigger className="soft-input h-11">
                    <SelectValue placeholder="O'qituvchini tanlang" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">O'qituvchi tanlanmagan</SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Sig'im *">
                <Input
                  className="soft-input h-11"
                  type="number"
                  min={1}
                  value={draft.capacity}
                  onChange={(event) => setDraft((prev) => ({ ...prev, capacity: event.target.value }))}
                />
              </Field>
              <Field label="Narx">
                <Input
                  className="soft-input h-11"
                  type="number"
                  value={draft.price}
                  onChange={(event) => setDraft((prev) => ({ ...prev, price: event.target.value }))}
                  placeholder="450000"
                />
              </Field>
            </div>
          </StepSection>

          <StepSection step={2} title="Dars tafsilotlari" hint="Jadval keyinroq timetable bo'limidan">
            <div className="rounded-xl border border-[#e7ecf8] bg-[#fbfcff] px-3 py-2 text-sm text-[#8f99b7]">
              Guruh dars jadvalini guruh yaratilgandan keyin <b>Timetable</b> sahifasida belgilang.
            </div>
          </StepSection>

          <StepSection step={3} title="A'zolar" hint="Ixtiyoriy: hozir biriktirish yoki keyinroq">
            <div className="flex flex-wrap gap-2">
              {students.map((student) => {
                const active = draft.studentIds.includes(student.id);
                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({
                        ...prev,
                        studentIds: active
                          ? prev.studentIds.filter((x) => x !== student.id)
                          : [...prev.studentIds, student.id],
                      }))
                    }
                    className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                      active
                        ? "border-[#5b60e4] bg-[#eef0ff] text-[#3f49c8]"
                        : "border-[#dce3f5] bg-white text-[#677298] hover:border-[#b6c1e5]"
                    }`}
                  >
                    {student.name}
                  </button>
                );
              })}
              {!students.length ? (
                <div className="rounded-xl border border-[#e7ecf8] bg-[#fbfcff] px-3 py-2 text-sm text-[#8f99b7]">
                  Aktiv o'quvchilar topilmadi
                </div>
              ) : null}
            </div>
          </StepSection>

          <GradientButton className="h-12 w-full rounded-xl text-base" onClick={createGroup}>
            <Users className="mr-1 h-4 w-4" />
            Guruh yaratish
          </GradientButton>
        </div>
      </ModalShell>
    </DashboardLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1">
      <span className="text-xs font-medium text-[#7c87a9]">{label}</span>
      {children}
    </label>
  );
}
