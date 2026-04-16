"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "./sidebar";
import { TopNav } from "./top-nav";
import { useAuthStore } from "@/lib/auth-store";
import { BRANCH_CHANGED_EVENT } from "@/lib/api/auth-storage";
import { Role } from "@/lib/types";

const ROLE_ROUTE_ACCESS: Record<Role, string[]> = {
  SUPER_ADMIN: [
    "/dashboard",
    "/students",
    "/teachers",
    "/parents",
    "/admins",
    "/groups",
    "/rooms",
    "/courses",
    "/timetable",
    "/attendance",
    "/staff-attendance",
    "/ratings",
    "/payments",
    "/finance",
    "/branches",
    "/tariffs",
    "/sms",
    "/action-logs",
    "/error-logs",
    "/users",
    "/uploads",
    "/settings",
  ],
  ADMIN: [
    "/dashboard",
    "/students",
    "/teachers",
    "/parents",
    "/admins",
    "/groups",
    "/rooms",
    "/courses",
    "/timetable",
    "/attendance",
    "/staff-attendance",
    "/ratings",
    "/payments",
    "/finance",
    "/tariffs",
    "/sms",
    "/action-logs",
    "/error-logs",
    "/users",
    "/uploads",
    "/settings",
  ],
  TEACHER: [
    "/dashboard",
    "/students",
    "/groups",
    "/rooms",
    "/courses",
    "/timetable",
    "/attendance",
    "/ratings",
  ],
  STUDENT: ["/dashboard", "/timetable", "/attendance", "/ratings", "/payments"],
  PARENT: ["/dashboard", "/payments"],
  STAFF: ["/dashboard", "/staff-attendance"],
};

function isAllowedPath(role: Role, pathname: string) {
  return ROLE_ROUTE_ACCESS[role].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  description?: string;
}

export function DashboardLayout({
  children,
  title,
  description,
}: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated, isLoading, bootstrap, user } = useAuthStore();
  const [branchRenderKey, setBranchRenderKey] = useState(0);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  useEffect(() => {
    if (!isLoading && isAuthenticated && user && !isAllowedPath(user.role, pathname)) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, isLoading, pathname, router, user]);

  useEffect(() => {
    const onBranchChanged = () => {
      setBranchRenderKey((prev) => prev + 1);
    };

    window.addEventListener(BRANCH_CHANGED_EVENT, onBranchChanged);
    return () => {
      window.removeEventListener(BRANCH_CHANGED_EVENT, onBranchChanged);
    };
  }, []);

  if (isLoading || !isAuthenticated) {
    return (
      <div className="soft-page min-h-screen flex items-center justify-center">
        <div className="h-10 w-10 rounded-full border-2 border-[#4c62df] border-t-transparent animate-spin" />
      </div>
    );
  }

  return (
    <div className="soft-page flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        <TopNav title={title} description={description} />
        <main className="flex-1 overflow-y-auto px-5 py-4 md:px-7 md:py-5">
          <div key={branchRenderKey} className="mx-auto w-full max-w-[1220px] space-y-4">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
