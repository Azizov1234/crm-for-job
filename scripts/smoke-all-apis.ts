import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { AppModule } from '../src/app.module';
import { SuperAdminBootstrapService } from '../src/common/services/super-admin-bootstrap.service';
import { GlobalExceptionFilter } from '../src/core/filters/global-exception.filter';
import { PrismaService } from '../src/core/prisma/prisma.service';
import type { UserRole } from '@prisma/client';
import { UserRole as PrismaUserRole } from '@prisma/client';

type HttpMethod = 'get' | 'post' | 'patch';

type CallOptions = {
  token?: string;
  body?: Record<string, unknown>;
  query?: Record<string, unknown>;
  files?: Array<{
    field: string;
    filePath: string;
    contentType?: string;
    filename?: string;
  }>;
  form?: Record<string, string>;
  expectedStatuses?: number[];
  note?: string;
};

type CallResult = {
  status: number;
  body: any;
};

const API_PREFIX = '/api/v1';

function nowDate(offsetDays = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

function buildUniqueTag() {
  const iso = new Date().toISOString().replace(/[-:.TZ]/g, '');
  const rnd = Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, '0');
  return `SMOKE_${iso}_${rnd}`;
}

function ensureSmokeAssets() {
  const dir = join(process.cwd(), 'tmp', 'smoke-assets');
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  const pdfPath = join(dir, 'sample.pdf');
  if (!existsSync(pdfPath)) {
    // Minimal valid PDF content for multipart testing.
    const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 200 200] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 44 >>
stream
BT /F1 12 Tf 72 120 Td (Smoke Test PDF) Tj ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000010 00000 n
0000000060 00000 n
0000000117 00000 n
0000000209 00000 n
trailer
<< /Root 1 0 R /Size 5 >>
startxref
302
%%EOF`;
    writeFileSync(pdfPath, pdfContent, 'utf8');
  }

  const mp4Path = join(dir, 'sample.mp4');
  if (!existsSync(mp4Path)) {
    // Placeholder bytes; validator checks MIME type only.
    // If Cloudinary is configured, a real mp4 file should be used.
    writeFileSync(mp4Path, Buffer.from('00000020667479706D703432', 'hex'));
  }

  return { pdfPath, mp4Path };
}

async function bootstrapApp() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(app.get(GlobalExceptionFilter));
  app.setGlobalPrefix('api/v1');
  await app.init();
  await app.get(SuperAdminBootstrapService).ensureSuperAdmin();
  return app;
}

async function callApi(
  app: INestApplication,
  method: HttpMethod,
  path: string,
  opts: CallOptions = {},
): Promise<CallResult> {
  let req = request(app.getHttpServer())[method](`${API_PREFIX}${path}`);

  if (opts.token) {
    req = req.set('Authorization', `Bearer ${opts.token}`);
  }

  if (opts.query) {
    req = req.query(opts.query as Record<string, string>);
  }

  if (opts.files?.length) {
    for (const [key, value] of Object.entries(opts.form ?? {})) {
      req = req.field(key, value);
    }

    for (const file of opts.files) {
      req = req.attach(file.field, file.filePath, {
        contentType: file.contentType,
        filename: file.filename,
      });
    }
  } else if (opts.body) {
    req = req.send(opts.body);
  }

  const res = await req;
  const expected = opts.expectedStatuses ?? [200, 201];
  if (!expected.includes(res.status)) {
    const details =
      typeof res.body === 'object' ? JSON.stringify(res.body) : String(res.text);
    throw new Error(
      `${method.toUpperCase()} ${path} -> ${res.status}, expected ${expected.join(
        ',',
      )}${opts.note ? ` (${opts.note})` : ''}. Body: ${details}`,
    );
  }

  return { status: res.status, body: res.body };
}

async function run() {
  const app = await bootstrapApp();
  const prisma = app.get(PrismaService);
  const unique = buildUniqueTag();
  const cloudinaryConfigured = [
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
  ].every((key) => (process.env[key] ?? '').trim().length > 0);

  const { pdfPath, mp4Path } = ensureSmokeAssets();
  const sampleImagePath = join(process.cwd(), 'src', 'images', 'image (41).png');

  const report: string[] = [];
  const ok = (text: string) => report.push(`PASS ${text}`);

  try {
    const identifier =
      process.env.SUPERADMIN_EMAIL ?? process.env.SUPERADMIN_PHONE;
    const password = process.env.SUPERADMIN_PASSWORD;
    if (!identifier || !password) {
      throw new Error(
        'SUPERADMIN_EMAIL/SUPERADMIN_PHONE yoki SUPERADMIN_PASSWORD topilmadi',
      );
    }

    const loginRes = await callApi(app, 'post', '/auth/login', {
      body: { identifier, password },
    });
    ok('POST /auth/login');
    const token = String(loginRes.body.data.accessToken);
    const me = await callApi(app, 'get', '/auth/me', { token });
    ok('GET /auth/me');
    const organizationId = String(me.body.data.organizationId);

    const primaryBranch = await callApi(app, 'post', '/branches', {
      token,
      body: {
        name: `Primary ${unique}`,
        code: `PR_${unique}`.slice(0, 30),
        phone: '+998901111111',
        email: `primary.${unique.toLowerCase()}@academy.uz`,
      },
    });
    ok('POST /branches');
    const branchId = String(primaryBranch.body.data.id);

    const secondaryBranch = await callApi(app, 'post', '/branches', {
      token,
      body: {
        name: `Secondary ${unique}`,
        code: `SC_${unique}`.slice(0, 30),
      },
    });
    ok('POST /branches (secondary)');
    const secondaryBranchId = String(secondaryBranch.body.data.id);

    await callApi(app, 'get', '/branches', { token, query: { page: 1, limit: 50 } });
    ok('GET /branches');
    await callApi(app, 'get', `/branches/${branchId}`, { token });
    ok('GET /branches/:id');
    await callApi(app, 'patch', `/branches/${branchId}`, {
      token,
      body: { name: `Primary Updated ${unique}` },
    });
    ok('PATCH /branches/:id');
    await callApi(app, 'patch', `/branches/${secondaryBranchId}/status`, {
      token,
      body: { status: 'INACTIVE' },
    });
    ok('PATCH /branches/:id/status -> INACTIVE');
    await callApi(app, 'patch', `/branches/${secondaryBranchId}/status`, {
      token,
      body: { status: 'ACTIVE' },
    });
    ok('PATCH /branches/:id/status -> ACTIVE');

    const staffUserRes = await callApi(app, 'post', '/users', {
      token,
      body: {
        firstName: 'Staff',
        lastName: unique,
        phone: '+998902222201',
        email: `staff.${unique.toLowerCase()}@academy.uz`,
        password: 'Staff123!',
        role: 'STAFF',
        branchId,
      },
    });
    ok('POST /users (staff)');
    const staffUserId = String(staffUserRes.body.data.id);

    const attachableUserRes = await callApi(app, 'post', '/users', {
      token,
      body: {
        firstName: 'Attach',
        lastName: unique,
        phone: '+998902222202',
        email: `attach.${unique.toLowerCase()}@academy.uz`,
        password: 'Attach123!',
        role: 'STAFF',
        branchId,
      },
    });
    ok('POST /users (attach target)');
    const attachableUserId = String(attachableUserRes.body.data.id);

    await callApi(app, 'get', '/users', { token, query: { page: 1, limit: 50 } });
    ok('GET /users');
    await callApi(app, 'get', '/users/select-options', {
      token,
      query: { branchId },
    });
    ok('GET /users/select-options');
    await callApi(app, 'get', `/users/${staffUserId}`, { token });
    ok('GET /users/:id');
    await callApi(app, 'patch', `/users/${staffUserId}`, {
      token,
      body: { firstName: 'Staff Updated' },
    });
    ok('PATCH /users/:id');
    await callApi(app, 'patch', `/users/${staffUserId}/status`, {
      token,
      body: { status: 'INACTIVE' },
    });
    ok('PATCH /users/:id/status -> INACTIVE');
    await callApi(app, 'patch', `/users/${staffUserId}/status`, {
      token,
      body: { status: 'ACTIVE' },
    });
    ok('PATCH /users/:id/status -> ACTIVE');

    const existingStaff = await prisma.staffProfile.findFirst({
      where: {
        userId: staffUserId,
        organizationId,
      },
      select: { id: true },
    });
    const staffProfile =
      existingStaff ??
      (await prisma.staffProfile.create({
        data: {
          organizationId,
          branchId,
          userId: staffUserId,
          position: 'Operator',
        },
        select: { id: true },
      }));
    const staffProfileId = staffProfile.id;

    const adminRes = await callApi(app, 'post', '/admins', {
      token,
      body: {
        firstName: 'Admin',
        lastName: unique,
        phone: '+998903333301',
        email: `admin.${unique.toLowerCase()}@academy.uz`,
        password: 'Admin123!',
        branchId,
        notes: 'Smoke admin',
      },
    });
    ok('POST /admins');
    const adminId = String(adminRes.body.data.id);

    await callApi(app, 'get', '/admins', { token, query: { page: 1, limit: 50 } });
    ok('GET /admins');
    await callApi(app, 'get', `/admins/${adminId}`, { token });
    ok('GET /admins/:id');
    await callApi(app, 'patch', `/admins/${adminId}`, {
      token,
      body: { notes: 'Smoke admin updated' },
    });
    ok('PATCH /admins/:id');
    await callApi(app, 'patch', `/admins/${adminId}/role`, {
      token,
      body: { role: 'ADMIN' },
    });
    ok('PATCH /admins/:id/role');
    await callApi(app, 'patch', `/admins/${adminId}/status`, {
      token,
      body: { status: 'INACTIVE' },
    });
    ok('PATCH /admins/:id/status -> INACTIVE');
    await callApi(app, 'patch', `/admins/${adminId}/status`, {
      token,
      body: { status: 'ACTIVE' },
    });
    ok('PATCH /admins/:id/status -> ACTIVE');

    const attachedAdminRes = await callApi(app, 'post', '/admins/attach-existing-user', {
      token,
      body: {
        userId: attachableUserId,
        branchId,
        notes: 'Attached from smoke',
      },
    });
    ok('POST /admins/attach-existing-user');
    const attachedAdminId = String(attachedAdminRes.body.data.id);

    const teacherRes = await callApi(app, 'post', '/teachers', {
      token,
      body: {
        firstName: 'Teacher',
        lastName: unique,
        phone: '+998904444401',
        email: `teacher.${unique.toLowerCase()}@academy.uz`,
        password: 'Teacher123!',
        specialty: 'Math',
        salary: 4500000,
        branchId,
      },
    });
    ok('POST /teachers');
    const teacherId = String(teacherRes.body.data.id);

    await callApi(app, 'get', '/teachers', { token, query: { page: 1, limit: 50 } });
    ok('GET /teachers');
    await callApi(app, 'get', '/teachers/select-options', {
      token,
      query: { branchId },
    });
    ok('GET /teachers/select-options');
    await callApi(app, 'get', `/teachers/${teacherId}`, { token });
    ok('GET /teachers/:id');
    await callApi(app, 'patch', `/teachers/${teacherId}`, {
      token,
      body: { specialty: 'Advanced Math' },
    });
    ok('PATCH /teachers/:id');
    await callApi(app, 'patch', `/teachers/${teacherId}/status`, {
      token,
      body: { status: 'INACTIVE' },
    });
    ok('PATCH /teachers/:id/status -> INACTIVE');
    await callApi(app, 'patch', `/teachers/${teacherId}/status`, {
      token,
      body: { status: 'ACTIVE' },
    });
    ok('PATCH /teachers/:id/status -> ACTIVE');

    const parentRes = await callApi(app, 'post', '/parents', {
      token,
      body: {
        firstName: 'Parent',
        lastName: unique,
        phone: '+998905555501',
        email: `parent.${unique.toLowerCase()}@academy.uz`,
        password: 'Parent123!',
        occupation: 'Engineer',
        branchId,
      },
    });
    ok('POST /parents');
    const parentId = String(parentRes.body.data.id);

    await callApi(app, 'get', '/parents', { token, query: { page: 1, limit: 50 } });
    ok('GET /parents');
    await callApi(app, 'get', `/parents/${parentId}`, { token });
    ok('GET /parents/:id');
    await callApi(app, 'patch', `/parents/${parentId}`, {
      token,
      body: { occupation: 'Designer' },
    });
    ok('PATCH /parents/:id');
    await callApi(app, 'patch', `/parents/${parentId}/status`, {
      token,
      body: { status: 'INACTIVE' },
    });
    ok('PATCH /parents/:id/status -> INACTIVE');
    await callApi(app, 'patch', `/parents/${parentId}/status`, {
      token,
      body: { status: 'ACTIVE' },
    });
    ok('PATCH /parents/:id/status -> ACTIVE');

    const courseRes = await callApi(app, 'post', '/courses', {
      token,
      body: {
        name: `Course ${unique}`,
        code: `CRS_${unique}`.slice(0, 30),
        price: 350000,
        durationMonth: 6,
        branchId,
      },
    });
    ok('POST /courses');
    const courseId = String(courseRes.body.data.id);

    await callApi(app, 'get', '/courses', { token, query: { page: 1, limit: 50 } });
    ok('GET /courses');
    await callApi(app, 'get', `/courses/${courseId}`, { token });
    ok('GET /courses/:id');
    await callApi(app, 'patch', `/courses/${courseId}`, {
      token,
      body: { description: 'Smoke updated course' },
    });
    ok('PATCH /courses/:id');
    await callApi(app, 'patch', `/courses/${courseId}/status`, {
      token,
      body: { status: 'INACTIVE' },
    });
    ok('PATCH /courses/:id/status -> INACTIVE');
    await callApi(app, 'patch', `/courses/${courseId}/status`, {
      token,
      body: { status: 'ACTIVE' },
    });
    ok('PATCH /courses/:id/status -> ACTIVE');

    const roomRes = await callApi(app, 'post', '/rooms', {
      token,
      body: {
        name: `Room ${unique}`,
        capacity: 25,
        floor: '2',
        branchId,
      },
    });
    ok('POST /rooms');
    const roomId = String(roomRes.body.data.id);

    await callApi(app, 'get', '/rooms', { token, query: { page: 1, limit: 50 } });
    ok('GET /rooms');
    await callApi(app, 'get', `/rooms/${roomId}`, { token });
    ok('GET /rooms/:id');
    await callApi(app, 'patch', `/rooms/${roomId}`, {
      token,
      body: { floor: '3' },
    });
    ok('PATCH /rooms/:id');
    await callApi(app, 'patch', `/rooms/${roomId}/status`, {
      token,
      body: { status: 'INACTIVE' },
    });
    ok('PATCH /rooms/:id/status -> INACTIVE');
    await callApi(app, 'patch', `/rooms/${roomId}/status`, {
      token,
      body: { status: 'ACTIVE' },
    });
    ok('PATCH /rooms/:id/status -> ACTIVE');

    const studentRes = await callApi(app, 'post', '/students', {
      token,
      body: {
        firstName: 'Student',
        lastName: unique,
        phone: '+998906666601',
        email: `student.${unique.toLowerCase()}@academy.uz`,
        password: 'Student123!',
        studentNo: `ST_${unique}`.slice(0, 30),
        branchId,
        parentIds: [parentId],
      },
    });
    ok('POST /students');
    const studentId = String(studentRes.body.data.id);

    await callApi(app, 'get', '/students', { token, query: { page: 1, limit: 50 } });
    ok('GET /students');
    await callApi(app, 'get', '/students/select-options', {
      token,
      query: { branchId },
    });
    ok('GET /students/select-options');
    await callApi(app, 'get', `/students/${studentId}`, { token });
    ok('GET /students/:id');
    await callApi(app, 'patch', `/students/${studentId}`, {
      token,
      body: { address: 'Tashkent' },
    });
    ok('PATCH /students/:id');
    await callApi(app, 'patch', `/students/${studentId}/status`, {
      token,
      body: { status: 'INACTIVE' },
    });
    ok('PATCH /students/:id/status -> INACTIVE');
    await callApi(app, 'patch', `/students/${studentId}/status`, {
      token,
      body: { status: 'ACTIVE' },
    });
    ok('PATCH /students/:id/status -> ACTIVE');
    await callApi(app, 'post', `/students/${studentId}/assign-parent`, {
      token,
      body: { parentIds: [parentId] },
    });
    ok('POST /students/:id/assign-parent');
    await callApi(app, 'post', `/parents/${parentId}/assign-student`, {
      token,
      body: { studentIds: [studentId] },
    });
    ok('POST /parents/:id/assign-student');

    const groupRes = await callApi(app, 'post', '/groups', {
      token,
      body: {
        name: `Group ${unique}`,
        code: `GR_${unique}`.slice(0, 30),
        courseId,
        roomId,
        teacherId,
        capacity: 20,
        price: 450000,
        branchId,
        studentIds: [studentId],
      },
    });
    ok('POST /groups');
    const groupId = String(groupRes.body.data.id);

    await callApi(app, 'get', '/groups', { token, query: { page: 1, limit: 50 } });
    ok('GET /groups');
    await callApi(app, 'get', `/groups/${groupId}`, { token });
    ok('GET /groups/:id');
    await callApi(app, 'patch', `/groups/${groupId}`, {
      token,
      body: { capacity: 22 },
    });
    ok('PATCH /groups/:id');
    await callApi(app, 'patch', `/groups/${groupId}/status`, {
      token,
      body: { status: 'INACTIVE' },
    });
    ok('PATCH /groups/:id/status -> INACTIVE');
    await callApi(app, 'patch', `/groups/${groupId}/status`, {
      token,
      body: { status: 'ACTIVE' },
    });
    ok('PATCH /groups/:id/status -> ACTIVE');
    await callApi(app, 'post', `/groups/${groupId}/students`, {
      token,
      body: { studentIds: [studentId] },
    });
    ok('POST /groups/:id/students');
    await callApi(app, 'patch', `/groups/${groupId}/teacher`, {
      token,
      body: { teacherId },
    });
    ok('PATCH /groups/:id/teacher');
    await callApi(app, 'patch', `/groups/${groupId}/room`, {
      token,
      body: { roomId },
    });
    ok('PATCH /groups/:id/room');
    await callApi(app, 'post', `/students/${studentId}/assign-groups`, {
      token,
      body: { groupIds: [groupId] },
    });
    ok('POST /students/:id/assign-groups');

    const timetableRes = await callApi(app, 'post', '/timetable', {
      token,
      body: {
        groupId,
        roomId,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '10:30',
        branchId,
      },
    });
    ok('POST /timetable');
    const timetableId = String(timetableRes.body.data.id);

    await callApi(app, 'get', '/timetable', {
      token,
      query: { page: 1, limit: 50, branchId },
    });
    ok('GET /timetable');
    await callApi(app, 'get', `/timetable/by-group/${groupId}`, { token });
    ok('GET /timetable/by-group/:groupId');
    await callApi(app, 'get', `/timetable/by-room/${roomId}`, { token });
    ok('GET /timetable/by-room/:roomId');
    await callApi(app, 'get', '/timetable/daily', { token, query: { branchId } });
    ok('GET /timetable/daily');
    await callApi(app, 'get', '/timetable/daily/list', {
      token,
      query: { branchId },
    });
    ok('GET /timetable/daily/list');
    await callApi(app, 'get', `/timetable/${timetableId}`, { token });
    ok('GET /timetable/:id');
    await callApi(app, 'patch', `/timetable/${timetableId}`, {
      token,
      body: { startTime: '10:00', endTime: '11:30' },
    });
    ok('PATCH /timetable/:id');
    await callApi(app, 'get', `/groups/${groupId}/timetable`, { token });
    ok('GET /groups/:id/timetable');

    const attendanceRes = await callApi(app, 'post', '/attendance', {
      token,
      body: {
        groupId,
        studentId,
        date: nowDate(0),
        attendanceStatus: 'PRESENT',
        note: 'on time',
        branchId,
      },
    });
    ok('POST /attendance');
    const attendanceId = String(attendanceRes.body.data.id);

    await callApi(app, 'post', '/attendance/bulk', {
      token,
      body: {
        records: [
          {
            groupId,
            studentId,
            date: nowDate(-1),
            attendanceStatus: 'LATE',
            branchId,
          },
        ],
      },
    });
    ok('POST /attendance/bulk');
    await callApi(app, 'get', '/attendance', {
      token,
      query: { page: 1, limit: 50, branchId },
    });
    ok('GET /attendance');
    await callApi(app, 'get', '/attendance/stats', { token, query: { branchId } });
    ok('GET /attendance/stats');
    await callApi(app, 'get', `/attendance/by-student/${studentId}`, {
      token,
      query: { page: 1, limit: 50 },
    });
    ok('GET /attendance/by-student/:studentId');
    await callApi(app, 'get', `/attendance/by-group/${groupId}`, {
      token,
      query: { page: 1, limit: 50 },
    });
    ok('GET /attendance/by-group/:groupId');
    await callApi(app, 'patch', `/attendance/${attendanceId}`, {
      token,
      body: { attendanceStatus: 'EXCUSED', note: 'doctor note' },
    });
    ok('PATCH /attendance/:id');
    await callApi(app, 'get', `/students/${studentId}/attendance`, { token });
    ok('GET /students/:id/attendance');

    const staffAttendanceRes = await callApi(app, 'post', '/staff-attendance', {
      token,
      body: {
        staffId: staffProfileId,
        date: nowDate(0),
        attendanceStatus: 'PRESENT',
        branchId,
      },
    });
    ok('POST /staff-attendance');
    const staffAttendanceId = String(staffAttendanceRes.body.data.id);

    await callApi(app, 'post', '/staff-attendance/bulk', {
      token,
      body: {
        records: [
          {
            staffId: staffProfileId,
            date: nowDate(-1),
            attendanceStatus: 'LATE',
            branchId,
          },
        ],
      },
    });
    ok('POST /staff-attendance/bulk');
    await callApi(app, 'get', '/staff-attendance', {
      token,
      query: { page: 1, limit: 50, branchId },
    });
    ok('GET /staff-attendance');
    await callApi(app, 'get', '/staff-attendance/stats', {
      token,
      query: { branchId },
    });
    ok('GET /staff-attendance/stats');
    await callApi(app, 'patch', `/staff-attendance/${staffAttendanceId}`, {
      token,
      body: { attendanceStatus: 'EXCUSED', note: 'approved leave' },
    });
    ok('PATCH /staff-attendance/:id');

    const ratingRes = await callApi(app, 'post', '/ratings', {
      token,
      body: {
        groupId,
        studentId,
        teacherId,
        score: 92,
        comment: 'Great progress',
        branchId,
      },
    });
    ok('POST /ratings');
    const ratingId = String(ratingRes.body.data.id);

    await callApi(app, 'get', '/ratings', {
      token,
      query: { page: 1, limit: 50, branchId },
    });
    ok('GET /ratings');
    await callApi(app, 'get', '/ratings/top', { token, query: { branchId } });
    ok('GET /ratings/top');
    await callApi(app, 'get', `/ratings/student/${studentId}`, {
      token,
      query: { page: 1, limit: 50 },
    });
    ok('GET /ratings/student/:studentId');
    await callApi(app, 'patch', `/ratings/${ratingId}`, {
      token,
      body: { score: 95, comment: 'Even better' },
    });
    ok('PATCH /ratings/:id');
    await callApi(app, 'get', `/groups/${groupId}/ratings`, { token });
    ok('GET /groups/:id/ratings');
    await callApi(app, 'get', `/students/${studentId}/ratings`, { token });
    ok('GET /students/:id/ratings');

    const paymentRes = await callApi(app, 'post', '/payments', {
      token,
      body: {
        studentId,
        groupId,
        amount: 600000,
        paidAmount: 100000,
        paymentStatus: 'PARTIAL',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        dueDate: nowDate(2),
        note: 'Smoke payment',
        branchId,
      },
    });
    ok('POST /payments');
    const paymentId = String(paymentRes.body.data.id);

    await callApi(app, 'get', '/payments', {
      token,
      query: { page: 1, limit: 50, branchId },
    });
    ok('GET /payments');
    await callApi(app, 'get', `/payments/${paymentId}`, { token });
    ok('GET /payments/:id');
    await callApi(app, 'patch', `/payments/${paymentId}`, {
      token,
      body: { note: 'Smoke payment updated' },
    });
    ok('PATCH /payments/:id');
    await callApi(app, 'post', `/payments/${paymentId}/pay`, {
      token,
      body: { amount: 100000, method: 'cash', note: 'partial pay' },
    });
    ok('POST /payments/:id/pay');
    await callApi(app, 'get', '/payments/stats/summary', {
      token,
      query: { branchId },
    });
    ok('GET /payments/stats/summary');
    await callApi(app, 'get', `/payments/student/${studentId}`, {
      token,
      query: { page: 1, limit: 50 },
    });
    ok('GET /payments/student/:studentId');
    await callApi(app, 'get', `/payments/history/${paymentId}`, { token });
    ok('GET /payments/history/:paymentId');
    await callApi(app, 'get', `/students/${studentId}/payments`, { token });
    ok('GET /students/:id/payments');

    const expenseRes = await callApi(app, 'post', '/finance/expenses', {
      token,
      body: {
        title: `Expense ${unique}`,
        category: 'salary',
        amount: 200000,
        expenseDate: nowDate(0),
        paidBy: staffUserId,
        note: 'Smoke expense',
        branchId,
      },
    });
    ok('POST /finance/expenses');
    const expenseId = String(expenseRes.body.data.id);

    await callApi(app, 'get', '/finance/expenses', {
      token,
      query: { page: 1, limit: 50, branchId },
    });
    ok('GET /finance/expenses');
    await callApi(app, 'patch', `/finance/expenses/${expenseId}`, {
      token,
      body: { amount: 210000, note: 'Smoke expense updated' },
    });
    ok('PATCH /finance/expenses/:id');
    await callApi(app, 'get', '/finance/summary', { token, query: { branchId } });
    ok('GET /finance/summary');
    await callApi(app, 'get', '/finance/cashflow', { token, query: { branchId } });
    ok('GET /finance/cashflow');

    await callApi(app, 'post', '/sms/send', {
      token,
      body: {
        recipientPhone: '+998907777701',
        message: `Single SMS ${unique}`,
        branchId,
      },
    });
    ok('POST /sms/send');
    await callApi(app, 'post', '/sms/bulk-send', {
      token,
      body: {
        recipients: ['+998907777702', '+998907777703'],
        message: `Bulk SMS ${unique}`,
        branchId,
      },
    });
    ok('POST /sms/bulk-send');
    await callApi(app, 'post', '/sms/notify/roles', {
      token,
      body: {
        roles: [PrismaUserRole.TEACHER as UserRole],
        message: `Role notify ${unique}`,
        branchId,
      },
    });
    ok('POST /sms/notify/roles');
    await callApi(app, 'post', '/sms/notify/due-payments', {
      token,
      body: {
        daysAhead: 5,
        branchId,
      },
    });
    ok('POST /sms/notify/due-payments');
    await callApi(app, 'post', '/sms/notify/staff-salary', {
      token,
      body: {
        staffUserId,
        amount: 1500000,
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        note: 'Smoke salary notify',
        branchId,
      },
    });
    ok('POST /sms/notify/staff-salary');
    await callApi(app, 'get', '/sms/logs', {
      token,
      query: { page: 1, limit: 50, branchId },
    });
    ok('GET /sms/logs');
    await callApi(app, 'get', '/sms/templates', {
      token,
      query: { page: 1, limit: 50, branchId },
    });
    ok('GET /sms/templates');

    const smsTemplateRes = await callApi(app, 'post', '/sms/templates', {
      token,
      body: {
        name: `Template ${unique}`,
        body: `Hello {{name}} ${unique}`,
        branchId,
      },
    });
    ok('POST /sms/templates');
    const smsTemplateId = String(smsTemplateRes.body.data.id);
    await callApi(app, 'patch', `/sms/templates/${smsTemplateId}`, {
      token,
      body: { body: `Updated {{name}} ${unique}` },
    });
    ok('PATCH /sms/templates/:id');

    const planRes = await callApi(app, 'post', '/tariffs/plans', {
      token,
      body: {
        name: `Plan ${unique}`,
        price: 1200000,
        durationDays: 30,
        studentLimit: 500,
        branchLimit: 10,
        features: { sms: true, analytics: true },
      },
    });
    ok('POST /tariffs/plans');
    const planId = String(planRes.body.data.id);
    await callApi(app, 'get', '/tariffs/plans', {
      token,
      query: { page: 1, limit: 50 },
    });
    ok('GET /tariffs/plans');
    await callApi(app, 'get', `/tariffs/plans/${planId}`, { token });
    ok('GET /tariffs/plans/:id');
    await callApi(app, 'patch', `/tariffs/plans/${planId}`, {
      token,
      body: { price: 1300000 },
    });
    ok('PATCH /tariffs/plans/:id');

    const subscriptionRes = await callApi(app, 'post', '/tariffs/subscriptions', {
      token,
      body: {
        tariffPlanId: planId,
        startDate: nowDate(0),
        endDate: nowDate(30),
        subscriptionStatus: 'ACTIVE',
        autoRenew: true,
      },
    });
    ok('POST /tariffs/subscriptions');
    const subscriptionId = String(subscriptionRes.body.data.id);
    await callApi(app, 'get', '/tariffs/subscriptions', {
      token,
      query: { page: 1, limit: 50 },
    });
    ok('GET /tariffs/subscriptions');
    await callApi(app, 'get', '/tariffs/subscriptions/current', { token });
    ok('GET /tariffs/subscriptions/current');
    await callApi(app, 'patch', `/tariffs/subscriptions/${subscriptionId}/status`, {
      token,
      body: { subscriptionStatus: 'ACTIVE' },
    });
    ok('PATCH /tariffs/subscriptions/:id/status');

    await callApi(app, 'get', '/settings/organization', { token });
    ok('GET /settings/organization');
    await callApi(app, 'patch', '/settings/organization', {
      token,
      body: {
        website: `https://smoke-${unique.toLowerCase()}.example.com`,
        primaryColor: '#1f4ce0',
      },
    });
    ok('PATCH /settings/organization');

    await callApi(app, 'post', '/settings/logo', {
      token,
      files: [
        {
          field: 'file',
          filePath: sampleImagePath,
          contentType: 'image/png',
          filename: 'smoke-logo.png',
        },
      ],
      expectedStatuses: cloudinaryConfigured ? [200, 201] : [503],
      note: cloudinaryConfigured
        ? 'cloudinary enabled'
        : 'cloudinary env missing - expecting 503',
    });
    ok('POST /settings/logo');

    await callApi(app, 'post', '/uploads/image', {
      token,
      files: [
        {
          field: 'file',
          filePath: sampleImagePath,
          contentType: 'image/png',
          filename: 'smoke-image.png',
        },
      ],
      expectedStatuses: cloudinaryConfigured ? [200, 201] : [503],
      note: cloudinaryConfigured
        ? 'cloudinary enabled'
        : 'cloudinary env missing - expecting 503',
    });
    ok('POST /uploads/image');
    await callApi(app, 'post', '/uploads/video', {
      token,
      files: [
        {
          field: 'file',
          filePath: mp4Path,
          contentType: 'video/mp4',
          filename: 'smoke-video.mp4',
        },
      ],
      expectedStatuses: cloudinaryConfigured ? [200, 201, 400] : [503],
      note: cloudinaryConfigured
        ? 'cloudinary enabled; placeholder file may produce 400'
        : 'cloudinary env missing - expecting 503',
    });
    ok('POST /uploads/video');
    await callApi(app, 'post', '/uploads/document', {
      token,
      files: [
        {
          field: 'file',
          filePath: pdfPath,
          contentType: 'application/pdf',
          filename: 'smoke-doc.pdf',
        },
      ],
      expectedStatuses: cloudinaryConfigured ? [200, 201] : [503],
      note: cloudinaryConfigured
        ? 'cloudinary enabled'
        : 'cloudinary env missing - expecting 503',
    });
    ok('POST /uploads/document');

    await callApi(app, 'get', '/dashboard/overview', { token, query: { branchId } });
    ok('GET /dashboard/overview');
    await callApi(app, 'get', '/dashboard/gender-stats', {
      token,
      query: { branchId },
    });
    ok('GET /dashboard/gender-stats');
    await callApi(app, 'get', '/dashboard/monthly-income', {
      token,
      query: { branchId, from: nowDate(-30), to: nowDate(0) },
    });
    ok('GET /dashboard/monthly-income');
    await callApi(app, 'get', '/dashboard/attendance-stats', {
      token,
      query: { branchId },
    });
    ok('GET /dashboard/attendance-stats');
    await callApi(app, 'get', '/dashboard/top-students', {
      token,
      query: { branchId },
    });
    ok('GET /dashboard/top-students');

    const actionLogsRes = await callApi(app, 'get', '/action-logs', {
      token,
      query: { page: 1, limit: 20 },
    });
    ok('GET /action-logs');
    const firstActionLogId = String(actionLogsRes.body.data?.[0]?.id ?? '');
    if (firstActionLogId) {
      await callApi(app, 'get', `/action-logs/${firstActionLogId}`, { token });
      ok('GET /action-logs/:id');
    } else {
      throw new Error('Action loglar bosh qaytdi, detail endpointni tekshirib bolmadi');
    }

    await callApi(app, 'get', '/users/not-existing-id', {
      token,
      expectedStatuses: [404],
      note: 'intentional 404 for error-log coverage',
    });
    ok('GET /users/not-existing-id (expected 404)');

    const errorLogsRes = await callApi(app, 'get', '/error-logs', {
      token,
      query: { page: 1, limit: 20 },
    });
    ok('GET /error-logs');
    const firstErrorLogId = String(errorLogsRes.body.data?.[0]?.id ?? '');
    if (firstErrorLogId) {
      await callApi(app, 'get', `/error-logs/${firstErrorLogId}`, { token });
      ok('GET /error-logs/:id');
    } else {
      throw new Error('Error loglar bosh qaytdi, detail endpointni tekshirib bolmadi');
    }

    await callApi(app, 'patch', `/attendance/${attendanceId}/delete`, { token });
    ok('PATCH /attendance/:id/delete');
    await callApi(app, 'patch', `/staff-attendance/${staffAttendanceId}/delete`, {
      token,
    });
    ok('PATCH /staff-attendance/:id/delete');
    await callApi(app, 'patch', `/ratings/${ratingId}/delete`, { token });
    ok('PATCH /ratings/:id/delete');
    await callApi(app, 'patch', `/payments/${paymentId}/delete`, { token });
    ok('PATCH /payments/:id/delete');
    await callApi(app, 'patch', `/finance/expenses/${expenseId}/delete`, { token });
    ok('PATCH /finance/expenses/:id/delete');
    await callApi(app, 'patch', `/timetable/${timetableId}/delete`, { token });
    ok('PATCH /timetable/:id/delete');
    await callApi(app, 'patch', `/sms/templates/${smsTemplateId}/delete`, { token });
    ok('PATCH /sms/templates/:id/delete');
    await callApi(app, 'patch', `/tariffs/plans/${planId}/delete`, { token });
    ok('PATCH /tariffs/plans/:id/delete');
    await callApi(app, 'patch', `/groups/${groupId}/delete`, { token });
    ok('PATCH /groups/:id/delete');
    await callApi(app, 'patch', `/rooms/${roomId}/delete`, { token });
    ok('PATCH /rooms/:id/delete');
    await callApi(app, 'patch', `/courses/${courseId}/delete`, { token });
    ok('PATCH /courses/:id/delete');
    await callApi(app, 'patch', `/students/${studentId}/delete`, { token });
    ok('PATCH /students/:id/delete');
    await callApi(app, 'patch', `/parents/${parentId}/delete`, { token });
    ok('PATCH /parents/:id/delete');
    await callApi(app, 'patch', `/teachers/${teacherId}/delete`, { token });
    ok('PATCH /teachers/:id/delete');
    await callApi(app, 'patch', `/admins/${attachedAdminId}/delete`, { token });
    ok('PATCH /admins/:id/delete (attached admin)');
    await callApi(app, 'patch', `/users/${staffUserId}/delete`, { token });
    ok('PATCH /users/:id/delete');
    await callApi(app, 'patch', `/branches/${secondaryBranchId}/delete`, { token });
    ok('PATCH /branches/:id/delete');

    await callApi(app, 'post', '/auth/logout', { token });
    ok('POST /auth/logout');

    const outputPath = join(process.cwd(), 'tmp', 'api-smoke-report.txt');
    writeFileSync(
      outputPath,
      [
        `Smoke run at ${new Date().toISOString()}`,
        `Cloudinary configured: ${cloudinaryConfigured ? 'yes' : 'no'}`,
        `Total successful checks: ${report.length}`,
        '',
        ...report,
      ].join('\n'),
      'utf8',
    );

    console.log(`Smoke test completed. Checks passed: ${report.length}`);
    console.log(`Report saved: ${outputPath}`);
    if (!cloudinaryConfigured) {
      console.log(
        'Cloudinary env topilmadi. Upload endpointlar 503 expected status bilan tekshirildi.',
      );
    }
  } finally {
    await app.close();
  }
}

void run().catch((error: unknown) => {
  console.error('Smoke test failed.');
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }
  process.exit(1);
});
