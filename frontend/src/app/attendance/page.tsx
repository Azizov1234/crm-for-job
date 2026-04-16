"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { CalendarCheck2, Filter, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { attendanceApi, groupsApi, studentsApi } from "@/lib/api/services";
import { Attendance, AttendanceStatus } from "@/lib/types";
import { formatDate } from "@/lib/utils-helpers";

type Option = { id: string; name: string };

const ATTENDANCE_OPTIONS: AttendanceStatus[] = ["PRESENT", "ABSENT", "LATE", "EXCUSED"];

const STATUS_STYLE: Record<AttendanceStatus, string> = {
  PRESENT: "bg-[#e8f8ef] text-[#1e9d5f] border-[#bdeacc]",
  ABSENT: "bg-[#ffedf1] text-[#d54f6f] border-[#f3c0ce]",
  LATE: "bg-[#fff7e8] text-[#d38c25] border-[#f0d7a9]",
  EXCUSED: "bg-[#f0edff] text-[#6552d8] border-[#cfc7ff]",
};

export default function AttendancePage() {
  const [records, setRecords] = useState<Attendance[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [students, setStudents] = useState<Option[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ALL");
  const [draft, setDraft] = useState({
    groupId: "",
    studentId: "",
    date: "",
    attendanceStatus: "PRESENT" as AttendanceStatus,
    note: "",
  });

  const summary = useMemo(() => {
    return ATTENDANCE_OPTIONS.reduce<Record<AttendanceStatus, number>>(
      (acc, item) => {
        acc[item] = records.filter((x) => x.attendanceStatus === item).length;
        return acc;
      },
      { PRESENT: 0, ABSENT: 0, LATE: 0, EXCUSED: 0 },
    );
  }, [records]);

  async function loadData() {
    try {
      setLoading(true);
      const [attendanceRes, groupsRes, studentsRes] = await Promise.all([
        attendanceApi.list({
          page: 1,
          limit: 100,
          search: search || undefined,
          attendanceStatus: status === "ALL" ? undefined : status,
        }),
        groupsApi.list({ page: 1, limit: 100, status: "ACTIVE" }),
        studentsApi.selectOptions(),
      ]);
      setRecords(attendanceRes.data);
      setGroups(groupsRes.data.map((item) => ({ id: item.id, name: item.name })));
      setStudents(studentsRes);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Davomat ma'lumotlari yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
  }, [status, search]);

  async function createAttendance() {
    if (!draft.groupId || !draft.studentId || !draft.date) {
      toast.error("Guruh, o'quvchi va sana majburiy");
      return;
    }

    try {
      await attendanceApi.create({
        groupId: draft.groupId,
        studentId: draft.studentId,
        date: draft.date,
        attendanceStatus: draft.attendanceStatus,
        note: draft.note.trim() || undefined,
      });
      toast.success("Davomat saqlandi");
      setDraft({
        groupId: "",
        studentId: "",
        date: "",
        attendanceStatus: "PRESENT",
        note: "",
      });
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Davomat yaratilmadi");
    }
  }

  async function softDeleteRecord(id: string) {
    try {
      await attendanceApi.remove(id);
      toast.success("Davomat yozuvi o'chirildi");
      await loadData();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete amalga oshmadi");
    }
  }

  return (
    <DashboardLayout title="Davomat" description="Kunlik davomat kuzatuvi va boshqaruvi">
      <section className="rounded-3xl border border-[#d7eadf] bg-[#eaf6f0] px-5 py-4">
        <div className="mb-3 flex items-center gap-2">
          <CalendarCheck2 className="h-5 w-5 text-[#2c8f62]" />
          <h1 className="text-2xl font-bold text-[#2a4f40]">Davomat paneli</h1>
        </div>
        <p className="text-sm text-[#577768]">O'quvchilar davomatini kuzatish va boshqarish</p>
      </section>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {ATTENDANCE_OPTIONS.map((item) => (
          <article key={item} className={`rounded-2xl border px-4 py-3 ${STATUS_STYLE[item]}`}>
            <p className="text-xs font-semibold uppercase tracking-[0.12em]">{item}</p>
            <p className="mt-1 text-2xl font-semibold">{summary[item]}</p>
          </article>
        ))}
      </section>

      <section className="panel-surface p-4">
        <h3 className="mb-3 text-sm font-semibold text-[#2f3655]">Yangi davomat qaydi</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
          <Select
            value={draft.groupId || "NONE"}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                groupId: (value ?? "NONE") === "NONE" ? "" : (value ?? ""),
              }))
            }
          >
            <SelectTrigger className="soft-input h-11">
              <SelectValue placeholder="Guruh" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">Guruhni tanlang</SelectItem>
              {groups.map((group) => (
                <SelectItem key={group.id} value={group.id}>
                  {group.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={draft.studentId || "NONE"}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                studentId: (value ?? "NONE") === "NONE" ? "" : (value ?? ""),
              }))
            }
          >
            <SelectTrigger className="soft-input h-11">
              <SelectValue placeholder="O'quvchi" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="NONE">O'quvchini tanlang</SelectItem>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            className="soft-input h-11"
            type="date"
            value={draft.date}
            onChange={(event) => setDraft((prev) => ({ ...prev, date: event.target.value }))}
          />

          <Select
            value={draft.attendanceStatus}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                attendanceStatus: (value ?? "PRESENT") as AttendanceStatus,
              }))
            }
          >
            <SelectTrigger className="soft-input h-11">
              <SelectValue placeholder="Holat" />
            </SelectTrigger>
            <SelectContent>
              {ATTENDANCE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            className="soft-input h-11"
            placeholder="Izoh"
            value={draft.note}
            onChange={(event) => setDraft((prev) => ({ ...prev, note: event.target.value }))}
          />

          <Button className="gradient-primary h-11 text-white" onClick={createAttendance}>
            <Plus className="mr-1 h-4 w-4" />
            Saqlash
          </Button>
        </div>
      </section>

      <section className="panel-surface p-4">
        <div className="mb-3 flex flex-wrap gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8c95ad]" />
            <Input
              className="soft-input h-11 pl-10"
              placeholder="O'quvchi yoki guruh bo'yicha qidiring..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <Select value={status} onValueChange={(value) => setStatus(value ?? "ALL")}>
            <SelectTrigger className="soft-input h-11 w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Barchasi</SelectItem>
              {ATTENDANCE_OPTIONS.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" className="h-11 rounded-xl border-[#e3e8f4]" onClick={loadData} disabled={loading}>
            <Filter className="mr-1 h-4 w-4" />
            Filterlash
          </Button>
        </div>

        {!records.length ? (
          <div className="rounded-2xl border border-[#e5ebf7] bg-[#fbfcff] px-4 py-16 text-center">
            <p className="text-lg font-semibold text-[#2e3655]">Davomat topilmadi</p>
            <p className="text-sm text-[#8b95b3]">Boshqa filterlarni sinab ko'ring</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-2xl border border-[#edf1fb]">
            <table className="min-w-full text-sm">
              <thead className="bg-[#f6f8fe] text-xs uppercase tracking-[0.11em] text-[#8e98b7]">
                <tr>
                  <th className="px-4 py-3 text-left">Sana</th>
                  <th className="px-4 py-3 text-left">O'quvchi</th>
                  <th className="px-4 py-3 text-left">Guruh</th>
                  <th className="px-4 py-3 text-left">Holat</th>
                  <th className="px-4 py-3 text-left">Izoh</th>
                  <th className="px-4 py-3 text-right">Amallar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1fb] bg-white">
                {records.map((record) => (
                  <tr key={record.id}>
                    <td className="px-4 py-3 text-[#2f3655]">{formatDate(record.date)}</td>
                    <td className="px-4 py-3 text-[#2f3655]">{record.student?.fullName ?? "-"}</td>
                    <td className="px-4 py-3 text-[#616b8e]">{record.group?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <Badge variant="outline">{record.attendanceStatus}</Badge>
                    </td>
                    <td className="px-4 py-3 text-[#616b8e]">{record.note ?? "-"}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-[#c7475c] hover:bg-[#fff0f3]"
                        onClick={() => softDeleteRecord(record.id)}
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
    </DashboardLayout>
  );
}
