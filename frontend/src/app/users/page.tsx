"use client";

import { useEffect, useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { AvatarUploadField } from "@/components/shared";
import { ApiError } from "@/lib/api/client";
import { getActiveBranchId } from "@/lib/api/auth-storage";
import { branchesApi, usersApi } from "@/lib/api/services";
import { Role, Status, User } from "@/lib/types";
import { formatDate, roleBadgeClass, roleLabel } from "@/lib/utils-helpers";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Pencil, Plus, Search, Trash2 } from "lucide-react";

const ROLE_OPTIONS: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "STAFF",
];
const ROLE_FILTER_OPTIONS = [...ROLE_OPTIONS, "MENTOR"] as const;

const STATUS_OPTIONS: Status[] = ["ACTIVE", "INACTIVE", "ARCHIVED", "DELETED"];

type Option = { id: string; name: string };

const EMPTY_DRAFT = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  password: "",
  role: "ADMIN" as Role,
  status: "ACTIVE" as Status,
  branchId: "",
  avatarUrl: "",
};

export default function UsersPage() {
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState<string>("ALL");
  const [status, setStatus] = useState<string>("ACTIVE");
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Option[]>([]);
  const [draft, setDraft] = useState(EMPTY_DRAFT);
  const [openEditCard, setOpenEditCard] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(EMPTY_DRAFT);

  async function loadUsers() {
    try {
      setLoading(true);
      const response = await usersApi.list({
        page: 1,
        limit: 100,
        search: search || undefined,
        role: role === "ALL" ? undefined : role,
        status: status === "ALL" ? undefined : status,
      });
      setUsers(response.data);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Foydalanuvchilar yuklanmadi");
    } finally {
      setLoading(false);
    }
  }

  async function loadBranches() {
    try {
      const response = await branchesApi.list({
        page: 1,
        limit: 200,
        status: "ACTIVE",
      });
      const options = (response.data as Array<{ id: string; name: string }>).map((branch) => ({
        id: branch.id,
        name: branch.name,
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
      void loadUsers();
    }, 250);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, role, status]);

  useEffect(() => {
    void loadBranches();
  }, []);

  async function createUser() {
    if (!draft.firstName.trim() || !draft.lastName.trim() || !draft.password.trim()) {
      toast.error("Ism, familiya va parol majburiy");
      return;
    }

    try {
      await usersApi.create({
        firstName: draft.firstName.trim(),
        lastName: draft.lastName.trim(),
        email: draft.email.trim() || undefined,
        phone: draft.phone.trim() || undefined,
        password: draft.password,
        role: draft.role,
        status: draft.status,
        branchId: draft.branchId || undefined,
        avatarUrl: draft.avatarUrl.trim() || undefined,
      });
      toast.success("Foydalanuvchi yaratildi");
      setDraft({
        ...EMPTY_DRAFT,
        branchId: getActiveBranchId() ?? branches[0]?.id ?? "",
      });
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Foydalanuvchi yaratilmadi");
    }
  }

  async function openEditUser(user: User) {
    try {
      const data = await usersApi.getById(user.id);
      setEditingUserId(user.id);
      setEditDraft({
        firstName: String(data.firstName ?? ""),
        lastName: String(data.lastName ?? ""),
        email: String(data.email ?? ""),
        phone: String(data.phone ?? ""),
        password: "",
        role: (String(data.role ?? "ADMIN") as Role) ?? "ADMIN",
        status: (String(data.status ?? "ACTIVE") as Status) ?? "ACTIVE",
        branchId: String(data.branchId ?? getActiveBranchId() ?? ""),
        avatarUrl: String(data.avatarUrl ?? ""),
      });
      setOpenEditCard(true);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "User ma'lumotini olishda xatolik");
    }
  }

  async function updateUser() {
    if (!editingUserId) return;

    if (!editDraft.firstName.trim() || !editDraft.lastName.trim()) {
      toast.error("Ism va familiya majburiy");
      return;
    }

    try {
      await usersApi.update(editingUserId, {
        firstName: editDraft.firstName.trim(),
        lastName: editDraft.lastName.trim(),
        email: editDraft.email.trim() || undefined,
        phone: editDraft.phone.trim() || undefined,
        password: editDraft.password.trim() || undefined,
        role: editDraft.role,
        status: editDraft.status,
        branchId: editDraft.branchId || undefined,
        avatarUrl: editDraft.avatarUrl.trim() || undefined,
      });
      toast.success("Foydalanuvchi yangilandi");
      setOpenEditCard(false);
      setEditingUserId(null);
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Yangilash amalga oshmadi");
    }
  }

  async function softDeleteUser(id: string) {
    try {
      await usersApi.remove(id);
      toast.success("Foydalanuvchi delete qilindi");
      await loadUsers();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Delete amalga oshmadi");
    }
  }

  const roleOptionLabel = (option: (typeof ROLE_FILTER_OPTIONS)[number]) =>
    option === "MENTOR" ? "Mentor" : roleLabel(option);

  return (
    <DashboardLayout title="Foydalanuvchilar" description="Backend /users endpointlari bilan boshqaruv">
      <div className="space-y-4">
        <Card className="glass">
          <CardHeader>
            <CardTitle className="text-base">Yangi foydalanuvchi</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-7">
            <Input
              placeholder="Ism"
              value={draft.firstName}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, firstName: event.target.value }))
              }
            />
            <Input
              placeholder="Familiya"
              value={draft.lastName}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, lastName: event.target.value }))
              }
            />
            <Input
              placeholder="Email"
              type="email"
              value={draft.email}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, email: event.target.value }))
              }
            />
            <Input
              placeholder="Telefon"
              value={draft.phone}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, phone: event.target.value }))
              }
            />
            <Input
              placeholder="Parol"
              type="password"
              value={draft.password}
              onChange={(event) =>
                setDraft((prev) => ({ ...prev, password: event.target.value }))
              }
            />
            <Select
              value={draft.role}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  role: (value ?? "ADMIN") as Role,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Role" />
              </SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {roleLabel(option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={draft.status}
              onValueChange={(value) =>
                setDraft((prev) => ({
                  ...prev,
                  status: (value ?? "ACTIVE") as Status,
                }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
              <Select
                value={draft.branchId || "NONE"}
                onValueChange={(value) =>
                  setDraft((prev) => ({
                    ...prev,
                    branchId: value && value !== "NONE" ? value : "",
                  }))
                }
              >
              <SelectTrigger>
                <SelectValue placeholder="Filial" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NONE">Filial tanlanmagan</SelectItem>
                {branches.map((branch) => (
                  <SelectItem key={branch.id} value={branch.id}>
                    {branch.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button className="gap-2" onClick={createUser}>
              <Plus className="h-4 w-4" />
              Saqlash
            </Button>
            <div className="md:col-span-7">
              <AvatarUploadField
                value={draft.avatarUrl || undefined}
                onChange={(url) =>
                  setDraft((prev) => ({
                    ...prev,
                    avatarUrl: url ?? "",
                  }))
                }
                title="Avatar rasmi"
                hint="Ixtiyoriy: user profile rasmi Cloudinary ga yuklanadi"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="glass">
          <CardContent className="pt-4">
            <div className="mb-4 flex flex-wrap gap-3">
              <div className="relative min-w-[220px] flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-10"
                  placeholder="Qidirish: ism/email/telefon"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <Select value={role} onValueChange={(value) => setRole(value ?? "ALL")}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="Role filter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">Barcha role</SelectItem>
                  {ROLE_FILTER_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {roleOptionLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={status} onValueChange={(value) => setStatus(value ?? "ACTIVE")}>
                <SelectTrigger className="w-44">
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

              <Button variant="outline" onClick={loadUsers} disabled={loading}>
                Yangilash
              </Button>
            </div>

            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>FIO</TableHead>
                    <TableHead>Aloqa</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Yaratilgan</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email ?? user.phone ?? "-"}</TableCell>
                      <TableCell>
                        <Badge className={roleBadgeClass(user.role)}>{roleLabel(user.role)}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.isActive ? "secondary" : "outline"}>
                          {user.status ?? (user.isActive ? "ACTIVE" : "INACTIVE")}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDate(user.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-blue-700"
                            onClick={() => openEditUser(user)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={() => softDeleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {openEditCard ? (
          <Card className="glass">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Foydalanuvchini yangilash</CardTitle>
              <Button
                variant="outline"
                onClick={() => {
                  setOpenEditCard(false);
                  setEditingUserId(null);
                }}
              >
                Yopish
              </Button>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input
                placeholder="Ism"
                value={editDraft.firstName}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, firstName: event.target.value }))
                }
              />
              <Input
                placeholder="Familiya"
                value={editDraft.lastName}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, lastName: event.target.value }))
                }
              />
              <Input
                placeholder="Email"
                type="email"
                value={editDraft.email}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, email: event.target.value }))
                }
              />
              <Input
                placeholder="Telefon"
                value={editDraft.phone}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, phone: event.target.value }))
                }
              />
              <Input
                placeholder="Yangi parol (ixtiyoriy)"
                type="password"
                value={editDraft.password}
                onChange={(event) =>
                  setEditDraft((prev) => ({ ...prev, password: event.target.value }))
                }
              />
              <Select
                value={editDraft.role}
                onValueChange={(value) =>
                  setEditDraft((prev) => ({
                    ...prev,
                    role: (value ?? "ADMIN") as Role,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {roleLabel(option)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={editDraft.status}
                onValueChange={(value) =>
                  setEditDraft((prev) => ({
                    ...prev,
                    status: (value ?? "ACTIVE") as Status,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={editDraft.branchId || "NONE"}
                onValueChange={(value) =>
                  setEditDraft((prev) => ({
                    ...prev,
                    branchId: value && value !== "NONE" ? value : "",
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filial" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="NONE">Filial tanlanmagan</SelectItem>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="md:col-span-3">
                <AvatarUploadField
                  value={editDraft.avatarUrl || undefined}
                  onChange={(url) =>
                    setEditDraft((prev) => ({
                      ...prev,
                      avatarUrl: url ?? "",
                    }))
                  }
                  title="Avatar rasmi"
                  hint="Ixtiyoriy: user profile rasmi Cloudinary ga yuklanadi"
                />
              </div>
              <div className="md:col-span-3 flex justify-end">
                <Button className="gap-2" onClick={updateUser}>
                  <Pencil className="h-4 w-4" />
                  Yangilash
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
