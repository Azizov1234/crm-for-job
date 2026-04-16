"use client";
/* eslint-disable react/no-unescaped-entities */

import { useEffect, useMemo, useState } from "react";
import { Building2, Filter, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { EmptyState, GradientButton, ModalShell, PageHero, SearchToolbar, StepSection } from "@/components/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ApiError } from "@/lib/api/client";
import { roomsApi } from "@/lib/api/services";
import { Status } from "@/lib/types";
import { formatDate } from "@/lib/utils-helpers";

const STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"];

type RoomRow = {
  id: string;
  name: string;
  capacity: number;
  floor: string | null;
  status: string;
  isActive: boolean;
  createdAt: string | null;
};

const EMPTY_ROOM_DRAFT = {
  name: "",
  capacity: "20",
  floor: "",
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

function mapRoomRow(raw: unknown): RoomRow {
  const item = toRecord(raw);
  const status = asString(item.status) || "ACTIVE";

  return {
    id: asString(item.id),
    name: asString(item.name) || "Noma'lum xona",
    capacity: asNumber(item.capacity),
    floor: asNullableString(item.floor),
    status,
    isActive: status === "ACTIVE",
    createdAt: asNullableString(item.createdAt),
  };
}

export default function RoomsPage() {
  const [rooms, setRooms] = useState<RoomRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("ACTIVE");
  const [openCreateModal, setOpenCreateModal] = useState(false);
  const [draft, setDraft] = useState(EMPTY_ROOM_DRAFT);

  const totalCount = useMemo(() => rooms.length, [rooms]);

  async function loadRooms() {
    try {
      setLoading(true);
      const response = await roomsApi.list({
        page: 1,
        limit: 100,
        search: search || undefined,
        status: status === "ALL" ? undefined : status,
      });
      setRooms((response.data as unknown[]).map(mapRoomRow));
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Xonalar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRooms();
  }, [status, search]);

  async function createRoom() {
    const parsedCapacity = Number(draft.capacity);
    if (!draft.name.trim() || !Number.isFinite(parsedCapacity) || parsedCapacity < 1) {
      toast.error("Xona nomi va to'g'ri sig'im majburiy");
      return;
    }

    try {
      await roomsApi.create({
        name: draft.name.trim(),
        capacity: parsedCapacity,
        floor: draft.floor.trim() || undefined,
      });
      toast.success("Yangi xona yaratildi");
      setOpenCreateModal(false);
      setDraft(EMPTY_ROOM_DRAFT);
      await loadRooms();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Yaratishda xatolik");
    }
  }

  async function softDeleteRoom(id: string) {
    try {
      await roomsApi.remove(id);
      toast.success("Xona o'chirildi");
      await loadRooms();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete amalga oshmadi");
    }
  }

  return (
    <DashboardLayout title="Xonalar" description="Dars xonalari va sig'im boshqaruvi">
      <PageHero
        title="Xonalar"
        subtitle="Akademiyadagi xonalar ro'yxatini yuriting"
        icon={Building2}
        statLabel="Jami xonalar"
        statValue={totalCount}
      />

      <SearchToolbar
        value={search}
        onChange={setSearch}
        onFilter={loadRooms}
        placeholder="Xonalarni qidiring..."
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
              Xona qo'shish
            </GradientButton>
          </>
        }
      />

      {!rooms.length ? (
        <EmptyState
          title="Xonalar topilmadi"
          subtitle="Filterlarni tekshiring yoki yangi xona qo'shing."
          action={
            <GradientButton className="rounded-xl px-5" onClick={() => setOpenCreateModal(true)}>
              <Plus className="mr-1 h-4 w-4" />
              Xona qo'shish
            </GradientButton>
          }
        />
      ) : (
        <section className="panel-surface overflow-hidden">
          <div className="grid grid-cols-[1.3fr_0.9fr_0.9fr_0.8fr_0.5fr] gap-3 border-b border-[#edf1fb] bg-[#f6f8fe] px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-[#8f99b7]">
            <span>Xona</span>
            <span>Sig'im</span>
            <span>Qavat</span>
            <span>Status</span>
            <span className="text-right">Amallar</span>
          </div>
          <div className="divide-y divide-[#edf1fb]">
            {rooms.map((room) => (
              <div
                key={room.id}
                className="grid grid-cols-[1.3fr_0.9fr_0.9fr_0.8fr_0.5fr] items-center gap-3 px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-semibold text-[#2f3655]">{room.name}</p>
                  <p className="text-xs text-[#8f99b7]">{formatDate(room.createdAt)}</p>
                </div>
                <span className="text-[#616b8e]">{room.capacity}</span>
                <span className="text-[#616b8e]">{room.floor ?? "-"}</span>
                <Badge variant={room.isActive ? "secondary" : "outline"}>{room.status}</Badge>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-[#c7475c] hover:bg-[#fff0f3]"
                    onClick={() => softDeleteRoom(room.id)}
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
        title="Yangi Xona"
        subtitle="Yangi yozuv yaratish uchun ma'lumotlarni kiriting"
      >
        <div className="space-y-4">
          <StepSection step={1} title="Xona tafsilotlari" hint="Xona nomi va sig'im ma'lumotlari">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Xona nomi *">
                <Input
                  className="soft-input h-11"
                  value={draft.name}
                  onChange={(event) => setDraft((prev) => ({ ...prev, name: event.target.value }))}
                  placeholder="Masalan, A-101"
                />
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
              <Field label="Qavat">
                <Input
                  className="soft-input h-11"
                  value={draft.floor}
                  onChange={(event) => setDraft((prev) => ({ ...prev, floor: event.target.value }))}
                  placeholder="3-qavat"
                />
              </Field>
            </div>
          </StepSection>

          <GradientButton className="h-12 w-full rounded-xl text-base" onClick={createRoom}>
            Xona yaratish
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
