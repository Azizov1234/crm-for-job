/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  ApiPaginatedResponse,
  ApiResponse,
  Attendance,
  AuthSession,
  CourseOption,
  DashboardOverview,
  Group,
  PaginatedResponse,
  Payment,
  Student,
  Teacher,
  User,
} from "../types";
import { apiRequest } from "./client";
import { getActiveBranchId } from "./auth-storage";

export type QueryParams = Record<
  string,
  string | number | boolean | undefined | null
>;

export type SelectOption = { id: string; name: string };

const shouldSkipActiveBranchScope = (path: string) =>
  path.startsWith("/branches");

const withActiveBranchScope = (params: QueryParams | undefined, path: string): QueryParams | undefined => {
  if (shouldSkipActiveBranchScope(path)) {
    return params;
  }

  const hasExplicitBranchId =
    params &&
    Object.prototype.hasOwnProperty.call(params, "branchId") &&
    params.branchId !== undefined &&
    params.branchId !== null &&
    params.branchId !== "";

  if (hasExplicitBranchId) {
    return params;
  }

  const activeBranchId = getActiveBranchId();
  if (!activeBranchId) {
    return params;
  }

  return {
    ...(params ?? {}),
    branchId: activeBranchId,
  };
};

const qs = (params: QueryParams = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : "";
};

const unwrapData = <T>(r: ApiResponse<T>) => r.data;
const unwrapList = <T>(r: ApiPaginatedResponse<T>): PaginatedResponse<T> => ({
  data: r.data,
  meta: r.meta,
});

const toFormData = (payload: Record<string, unknown> = {}) => {
  const formData = new FormData();

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined || value === null || value === "") continue;

    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      formData.append(key, JSON.stringify(value));
      continue;
    }

    if (value instanceof Blob) {
      formData.append(key, value);
      continue;
    }

    if (value instanceof Date) {
      formData.append(key, value.toISOString());
      continue;
    }

    formData.append(key, String(value));
  }

  return formData;
};

const get = async <T = any>(path: string) =>
  unwrapData(await apiRequest<ApiResponse<T>>(path));
const post = async <T = any>(path: string, body?: unknown) =>
  unwrapData(
    await apiRequest<ApiResponse<T>>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  );
const patch = async <T = any>(path: string, body?: unknown) =>
  unwrapData(
    await apiRequest<ApiResponse<T>>(path, {
      method: "PATCH",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  );
const postMultipart = async <T = any>(
  path: string,
  payload?: Record<string, unknown>,
) => post<T>(path, toFormData(payload));
const patchMultipart = async <T = any>(
  path: string,
  payload?: Record<string, unknown>,
) => patch<T>(path, toFormData(payload));
const list = async <T = any>(path: string, params?: QueryParams) =>
  unwrapList(
    await apiRequest<ApiPaginatedResponse<T>>(
      `${path}${qs(withActiveBranchScope(params, path) ?? {})}`,
    ),
  );

const mapUser = (raw: any): User => {
  const firstName = raw.firstName ?? "";
  const lastName = raw.lastName ?? "";
  const status = raw.status ?? "ACTIVE";
  return {
    id: raw.id,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`.trim(),
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    avatarUrl: raw.avatarUrl ?? null,
    role: raw.role,
    status,
    isActive: status === "ACTIVE",
    branchId: raw.branchId ?? null,
    organizationId: raw.organizationId,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
  };
};

const mapStudent = (raw: any): Student => {
  const firstName = raw.user?.firstName ?? "";
  const lastName = raw.user?.lastName ?? "";
  const status = raw.status ?? "ACTIVE";
  return {
    id: raw.id,
    name: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    email: raw.user?.email ?? null,
    phone: raw.user?.phone ?? null,
    avatarUrl: raw.user?.avatarUrl ?? null,
    studentNo: raw.studentNo ?? null,
    status,
    isActive: status === "ACTIVE",
    createdAt: raw.createdAt,
  };
};

const mapTeacher = (raw: any): Teacher => {
  const firstName = raw.user?.firstName ?? "";
  const lastName = raw.user?.lastName ?? "";
  const status = raw.status ?? "ACTIVE";
  return {
    id: raw.id,
    name: `${firstName} ${lastName}`.trim(),
    firstName,
    lastName,
    email: raw.user?.email ?? null,
    phone: raw.user?.phone ?? null,
    avatarUrl: raw.user?.avatarUrl ?? null,
    specialty: raw.specialty ?? null,
    salary: raw.salary !== undefined ? Number(raw.salary) : null,
    status,
    isActive: status === "ACTIVE",
    createdAt: raw.createdAt,
  };
};

const mapGroup = (raw: any): Group => {
  const status = raw.status ?? "ACTIVE";
  return {
    id: raw.id,
    name: raw.name,
    code: raw.code ?? null,
    capacity: raw.capacity ?? 0,
    price: raw.price !== undefined ? Number(raw.price) : null,
    status,
    isActive: status === "ACTIVE",
    createdAt: raw.createdAt,
    course: raw.course ? { id: raw.course.id, name: raw.course.name } : null,
    teacher: raw.teacher?.user
      ? {
          id: raw.teacher.id,
          fullName: `${raw.teacher.user.firstName} ${raw.teacher.user.lastName}`.trim(),
        }
      : null,
  };
};

const mapAttendance = (raw: any): Attendance => ({
  id: raw.id,
  date: raw.date,
  attendanceStatus: raw.attendanceStatus,
  note: raw.note ?? null,
  status: raw.status,
  student: raw.student?.user
    ? {
        id: raw.student.id,
        fullName: `${raw.student.user.firstName} ${raw.student.user.lastName}`.trim(),
      }
    : null,
  group: raw.group ? { id: raw.group.id, name: raw.group.name } : null,
});

const mapPayment = (raw: any): Payment => ({
  id: raw.id,
  studentId: raw.studentId,
  studentName: raw.student?.user
    ? `${raw.student.user.firstName} ${raw.student.user.lastName}`.trim()
    : raw.studentId,
  groupId: raw.groupId ?? null,
  groupName: raw.group?.name ?? null,
  amount: Number(raw.amount ?? 0),
  paidAmount: Number(raw.paidAmount ?? 0),
  paymentStatus: raw.paymentStatus,
  month: raw.month,
  year: raw.year,
  createdAt: raw.createdAt,
  status: raw.status,
});

const mapOption = (item: any): SelectOption => ({
  id: item.id,
  name:
    item.name ??
    `${item.user?.firstName ?? item.firstName ?? ""} ${item.user?.lastName ?? item.lastName ?? ""}`.trim(),
});

export const authApi = {
  login: async (payload: { identifier: string; password: string }) => {
    const r = await apiRequest<
      ApiResponse<{ accessToken: string; user: any }>
    >("/auth/login", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify(payload),
    });
    const data = unwrapData(r);
    return { accessToken: data.accessToken, user: mapUser(data.user) } satisfies AuthSession;
  },
  me: async () => mapUser(await get("/auth/me")),
  logout: async () => post("/auth/logout"),
};

export const dashboardApi = {
  overview: async (params?: QueryParams) =>
    get<DashboardOverview>(
      `/dashboard/overview${qs(withActiveBranchScope(params, "/dashboard/overview") ?? {})}`,
    ),
  genderStats: async (params?: QueryParams) =>
    get<Array<{ gender: string | null; count: number }>>(
      `/dashboard/gender-stats${qs(withActiveBranchScope(params, "/dashboard/gender-stats") ?? {})}`,
    ),
  monthlyIncome: async (params?: QueryParams) =>
    get<Array<{ month: string; amount: number }>>(
      `/dashboard/monthly-income${qs(withActiveBranchScope(params, "/dashboard/monthly-income") ?? {})}`,
    ),
  attendanceStats: async (params?: QueryParams) =>
    get<Array<{ status: string; count: number }>>(
      `/dashboard/attendance-stats${qs(withActiveBranchScope(params, "/dashboard/attendance-stats") ?? {})}`,
    ),
  topStudents: async (params?: QueryParams) =>
    get<Array<{ fullName: string; avgScore: number; ratingCount: number }>>(
      `/dashboard/top-students${qs(withActiveBranchScope(params, "/dashboard/top-students") ?? {})}`,
    ),
};

export const usersApi = {
  list: async (params?: QueryParams) => {
    const r = await list("/users", params);
    return { data: r.data.map(mapUser), meta: r.meta } satisfies PaginatedResponse<User>;
  },
  create: (payload: Record<string, unknown>) => postMultipart("/users", payload),
  getById: (id: string) => get(`/users/${id}`),
  update: (id: string, payload: Record<string, unknown>) =>
    patchMultipart(`/users/${id}`, payload),
  remove: (id: string) => patch(`/users/${id}/delete`),
  changeStatus: (id: string, status: string) => patch(`/users/${id}/status`, { status }),
  selectOptions: async (branchId?: string) =>
    (await get<any[]>(
      `/users/select-options${qs(withActiveBranchScope({ branchId }, "/users/select-options") ?? {})}`,
    )).map(mapOption),
};

export const studentsApi = {
  list: async (params?: QueryParams) => {
    const r = await list("/students", params);
    return { data: r.data.map(mapStudent), meta: r.meta } satisfies PaginatedResponse<Student>;
  },
  create: (payload: Record<string, unknown>) =>
    postMultipart("/students", payload),
  getById: (id: string) => get(`/students/${id}`),
  update: (id: string, payload: Record<string, unknown>) =>
    patchMultipart(`/students/${id}`, payload),
  remove: (id: string) => patch(`/students/${id}/delete`),
  changeStatus: (id: string, status: string) => patch(`/students/${id}/status`, { status }),
  assignParents: (id: string, parentIds: string[]) =>
    post(`/students/${id}/assign-parent`, { parentIds }),
  assignGroups: (id: string, groupIds: string[]) =>
    post(`/students/${id}/assign-groups`, { groupIds }),
  payments: (id: string) => get(`/students/${id}/payments`),
  attendance: (id: string) => get(`/students/${id}/attendance`),
  ratings: (id: string) => get(`/students/${id}/ratings`),
  selectOptions: async (branchId?: string) =>
    (await get<any[]>(
      `/students/select-options${qs(withActiveBranchScope({ branchId }, "/students/select-options") ?? {})}`,
    )).map(mapOption),
};

export const teachersApi = {
  list: async (params?: QueryParams) => {
    const r = await list("/teachers", params);
    return { data: r.data.map(mapTeacher), meta: r.meta } satisfies PaginatedResponse<Teacher>;
  },
  create: (payload: Record<string, unknown>) =>
    postMultipart("/teachers", payload),
  getById: (id: string) => get(`/teachers/${id}`),
  update: (id: string, payload: Record<string, unknown>) =>
    patchMultipart(`/teachers/${id}`, payload),
  remove: (id: string) => patch(`/teachers/${id}/delete`),
  changeStatus: (id: string, status: string) => patch(`/teachers/${id}/status`, { status }),
  selectOptions: async (branchId?: string) =>
    (await get<any[]>(
      `/teachers/select-options${qs(withActiveBranchScope({ branchId }, "/teachers/select-options") ?? {})}`,
    )).map(mapOption),
};

export const coursesApi = {
  list: async (params?: QueryParams) => {
    const r = await list("/courses", params);
    return {
      data: r.data.map((x: any) => ({
        id: x.id,
        name: x.name,
        code: x.code ?? null,
        description: x.description ?? null,
        price: x.price !== undefined ? Number(x.price) : null,
        durationMonth: x.durationMonth ?? null,
        status: x.status ?? "ACTIVE",
        createdAt: x.createdAt ?? null,
      })) as CourseOption[],
      meta: r.meta,
    };
  },
  create: (payload: Record<string, unknown>) => post("/courses", payload),
  getById: (id: string) => get(`/courses/${id}`),
  update: (id: string, payload: Record<string, unknown>) => patch(`/courses/${id}`, payload),
  remove: (id: string) => patch(`/courses/${id}/delete`),
  changeStatus: (id: string, status: string) => patch(`/courses/${id}/status`, { status }),
};

export const groupsApi = {
  list: async (params?: QueryParams) => {
    const r = await list("/groups", params);
    return { data: r.data.map(mapGroup), meta: r.meta } satisfies PaginatedResponse<Group>;
  },
  create: (payload: Record<string, unknown>) => post("/groups", payload),
  getById: (id: string) => get(`/groups/${id}`),
  update: (id: string, payload: Record<string, unknown>) => patch(`/groups/${id}`, payload),
  remove: (id: string) => patch(`/groups/${id}/delete`),
  changeStatus: (id: string, status: string) => patch(`/groups/${id}/status`, { status }),
  addStudents: (id: string, studentIds: string[]) => post(`/groups/${id}/students`, { studentIds }),
  updateTeacher: (id: string, teacherId?: string | null) =>
    patch(`/groups/${id}/teacher`, { teacherId: teacherId ?? null }),
  updateRoom: (id: string, roomId?: string | null) =>
    patch(`/groups/${id}/room`, { roomId: roomId ?? null }),
  timetable: (id: string) => get(`/groups/${id}/timetable`),
  ratings: (id: string) => get(`/groups/${id}/ratings`),
};

export const attendanceApi = {
  list: async (params?: QueryParams) => {
    const r = await list("/attendance", params);
    return { data: r.data.map(mapAttendance), meta: r.meta } satisfies PaginatedResponse<Attendance>;
  },
  create: (payload: Record<string, unknown>) => post("/attendance", payload),
  bulkCreate: (payload: Record<string, unknown>) => post("/attendance/bulk", payload),
  stats: (params?: QueryParams) =>
    get(`/attendance/stats${qs(withActiveBranchScope(params, "/attendance/stats") ?? {})}`),
  byStudent: (studentId: string, params?: QueryParams) =>
    list(`/attendance/by-student/${studentId}`, params),
  byGroup: (groupId: string, params?: QueryParams) =>
    list(`/attendance/by-group/${groupId}`, params),
  update: (id: string, payload: Record<string, unknown>) => patch(`/attendance/${id}`, payload),
  remove: (id: string) => patch(`/attendance/${id}/delete`),
};

export const paymentsApi = {
  list: async (params?: QueryParams) => {
    const r = await list("/payments", params);
    return { data: r.data.map(mapPayment), meta: r.meta } satisfies PaginatedResponse<Payment>;
  },
  create: (payload: Record<string, unknown>) => post("/payments", payload),
  getById: (id: string) => get(`/payments/${id}`),
  update: (id: string, payload: Record<string, unknown>) => patch(`/payments/${id}`, payload),
  remove: (id: string) => patch(`/payments/${id}/delete`),
  pay: (id: string, payload: Record<string, unknown>) => post(`/payments/${id}/pay`, payload),
  stats: (params?: QueryParams) =>
    get(`/payments/stats/summary${qs(withActiveBranchScope(params, "/payments/stats/summary") ?? {})}`),
  byStudent: (studentId: string, params?: QueryParams) =>
    list(`/payments/student/${studentId}`, params),
  history: (paymentId: string) => get(`/payments/history/${paymentId}`),
};

export const settingsApi = {
  getOrganization: () => get("/settings/organization"),
  updateOrganization: (payload: Record<string, unknown>) =>
    patch("/settings/organization", payload),
  uploadLogo: async (file: File) => {
    const f = new FormData();
    f.append("file", file);
    return post("/settings/logo", f);
  },
};

export const uploadsApi = {
  uploadImage: async (file: File) => {
    const f = new FormData();
    f.append("file", file);
    const data = await post<{ url: string; publicId: string }>("/uploads/image", f);
    return { ...data, type: "image" as const };
  },
  uploadVideo: async (file: File) => {
    const f = new FormData();
    f.append("file", file);
    const data = await post<{ url: string; publicId: string }>("/uploads/video", f);
    return { ...data, type: "video" as const };
  },
  uploadDocument: async (file: File) => {
    const f = new FormData();
    f.append("file", file);
    const data = await post<{ url: string; publicId: string }>("/uploads/document", f);
    return { ...data, type: "document" as const };
  },
};

export const adminsApi = {
  list: (params?: QueryParams) => list("/admins", params),
  create: (payload: Record<string, unknown>) =>
    postMultipart("/admins", payload),
  getById: (id: string) => get(`/admins/${id}`),
  update: (id: string, payload: Record<string, unknown>) =>
    patchMultipart(`/admins/${id}`, payload),
  remove: (id: string) => patch(`/admins/${id}/delete`),
  updateRole: (id: string, role: string) => patch(`/admins/${id}/role`, { role }),
  attachExistingUser: (payload: Record<string, unknown>) =>
    post("/admins/attach-existing-user", payload),
  changeStatus: (id: string, status: string) =>
    patch(`/admins/${id}/status`, { status }),
};

export const branchesApi = {
  list: (params?: QueryParams) => list("/branches", params),
  create: (payload: Record<string, unknown>) => post("/branches", payload),
  getById: (id: string) => get(`/branches/${id}`),
  update: (id: string, payload: Record<string, unknown>) =>
    patch(`/branches/${id}`, payload),
  remove: (id: string) => patch(`/branches/${id}/delete`),
  changeStatus: (id: string, status: string) =>
    patch(`/branches/${id}/status`, { status }),
};

export const parentsApi = {
  list: (params?: QueryParams) => list("/parents", params),
  create: (payload: Record<string, unknown>) =>
    postMultipart("/parents", payload),
  getById: (id: string) => get(`/parents/${id}`),
  update: (id: string, payload: Record<string, unknown>) =>
    patchMultipart(`/parents/${id}`, payload),
  remove: (id: string) => patch(`/parents/${id}/delete`),
  changeStatus: (id: string, status: string) =>
    patch(`/parents/${id}/status`, { status }),
  assignStudent: (id: string, studentIds: string[]) =>
    post(`/parents/${id}/assign-student`, { studentIds }),
};

export const roomsApi = {
  list: (params?: QueryParams) => list("/rooms", params),
  create: (payload: Record<string, unknown>) => post("/rooms", payload),
  getById: (id: string) => get(`/rooms/${id}`),
  update: (id: string, payload: Record<string, unknown>) =>
    patch(`/rooms/${id}`, payload),
  remove: (id: string) => patch(`/rooms/${id}/delete`),
  changeStatus: (id: string, status: string) =>
    patch(`/rooms/${id}/status`, { status }),
};

export const timetableApi = {
  list: (params?: QueryParams) => list("/timetable", params),
  create: (payload: Record<string, unknown>) => post("/timetable", payload),
  getById: (id: string) => get(`/timetable/${id}`),
  update: (id: string, payload: Record<string, unknown>) =>
    patch(`/timetable/${id}`, payload),
  remove: (id: string) => patch(`/timetable/${id}/delete`),
  byGroup: (groupId: string) => get(`/timetable/by-group/${groupId}`),
  byRoom: (roomId: string) => get(`/timetable/by-room/${roomId}`),
  daily: (params?: QueryParams) =>
    get(`/timetable/daily${qs(withActiveBranchScope(params, "/timetable/daily") ?? {})}`),
  dailyList: (params?: QueryParams) =>
    get(
      `/timetable/daily/list${qs(withActiveBranchScope(params, "/timetable/daily/list") ?? {})}`,
    ),
};

export const staffAttendanceApi = {
  list: (params?: QueryParams) => list("/staff-attendance", params),
  create: (payload: Record<string, unknown>) => post("/staff-attendance", payload),
  bulkCreate: (payload: Record<string, unknown>) =>
    post("/staff-attendance/bulk", payload),
  stats: (params?: QueryParams) =>
    get(
      `/staff-attendance/stats${qs(withActiveBranchScope(params, "/staff-attendance/stats") ?? {})}`,
    ),
  update: (id: string, payload: Record<string, unknown>) =>
    patch(`/staff-attendance/${id}`, payload),
  remove: (id: string) => patch(`/staff-attendance/${id}/delete`),
};

export const ratingsApi = {
  list: (params?: QueryParams) => list("/ratings", params),
  create: (payload: Record<string, unknown>) => post("/ratings", payload),
  top: (params?: QueryParams) =>
    get(`/ratings/top${qs(withActiveBranchScope(params, "/ratings/top") ?? {})}`),
  byStudent: (studentId: string, params?: QueryParams) =>
    list(`/ratings/student/${studentId}`, params),
  update: (id: string, payload: Record<string, unknown>) =>
    patch(`/ratings/${id}`, payload),
  remove: (id: string) => patch(`/ratings/${id}/delete`),
};

export const tariffsApi = {
  plans: {
    list: (params?: QueryParams) => list("/tariffs/plans", params),
    create: (payload: Record<string, unknown>) => post("/tariffs/plans", payload),
    getById: (id: string) => get(`/tariffs/plans/${id}`),
    update: (id: string, payload: Record<string, unknown>) =>
      patch(`/tariffs/plans/${id}`, payload),
    remove: (id: string) => patch(`/tariffs/plans/${id}/delete`),
  },
  subscriptions: {
    list: (params?: QueryParams) => list("/tariffs/subscriptions", params),
    create: (payload: Record<string, unknown>) =>
      post("/tariffs/subscriptions", payload),
    current: () => get("/tariffs/subscriptions/current"),
    changeStatus: (id: string, payload: Record<string, unknown>) =>
      patch(`/tariffs/subscriptions/${id}/status`, payload),
  },
};

export const smsApi = {
  send: (payload: Record<string, unknown>) => post("/sms/send", payload),
  bulkSend: (payload: Record<string, unknown>) => post("/sms/bulk-send", payload),
  notifyRoles: (payload: Record<string, unknown>) =>
    post("/sms/notify/roles", payload),
  notifyDuePayments: (payload: Record<string, unknown>) =>
    post("/sms/notify/due-payments", payload),
  notifyStaffSalary: (payload: Record<string, unknown>) =>
    post("/sms/notify/staff-salary", payload),
  logs: (params?: QueryParams) => list("/sms/logs", params),
  templates: {
    list: (params?: QueryParams) => list("/sms/templates", params),
    create: (payload: Record<string, unknown>) => post("/sms/templates", payload),
    update: (id: string, payload: Record<string, unknown>) =>
      patch(`/sms/templates/${id}`, payload),
    remove: (id: string) => patch(`/sms/templates/${id}/delete`),
  },
};

export const financeApi = {
  expenses: {
    list: (params?: QueryParams) => list("/finance/expenses", params),
    create: (payload: Record<string, unknown>) => post("/finance/expenses", payload),
    update: (id: string, payload: Record<string, unknown>) =>
      patch(`/finance/expenses/${id}`, payload),
    remove: (id: string) => patch(`/finance/expenses/${id}/delete`),
  },
  summary: (params?: QueryParams) =>
    get(`/finance/summary${qs(withActiveBranchScope(params, "/finance/summary") ?? {})}`),
  cashflow: (params?: QueryParams) =>
    get(`/finance/cashflow${qs(withActiveBranchScope(params, "/finance/cashflow") ?? {})}`),
};

export const actionLogsApi = {
  list: (params?: QueryParams) => list("/action-logs", params),
  getById: (id: string) => get(`/action-logs/${id}`),
};

export const errorLogsApi = {
  list: (params?: QueryParams) => list("/error-logs", params),
  getById: (id: string) => get(`/error-logs/${id}`),
};
