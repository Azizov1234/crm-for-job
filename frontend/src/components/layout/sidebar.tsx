"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  Building2,
  CalendarDays,
  ChevronDown,
  CreditCard,
  GraduationCap,
  Home,
  LogOut,
  MessageSquareText,
  PercentCircle,
  School,
  Settings2,
  ShieldAlert,
  ShieldUser,
  SquareActivity,
  UserRoundCheck,
  UserSquare2,
  Users2,
  Wallet,
  LayoutDashboard,
  HelpCircle,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/auth-store";
import { Role } from "@/lib/types";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  roles: Role[];
};

type Section = {
  id: string;
  label: string;
  items: NavItem[];
  collapsible?: boolean;
};

const EVERYONE: Role[] = [
  "SUPER_ADMIN",
  "ADMIN",
  "TEACHER",
  "STUDENT",
  "PARENT",
  "STAFF",
];

const NAV_SECTIONS: Section[] = [
  {
    id: "main",
    label: "",
    items: [{ href: "/dashboard", label: "Bosh sahifa", icon: Home, roles: EVERYONE }],
  },
  {
    id: "academy",
    label: "AKADEMIYA",
    items: [
      {
        href: "/teachers",
        label: "O'qituvchilar",
        icon: GraduationCap,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        href: "/students",
        label: "O'quvchilar",
        icon: UserSquare2,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"],
      },
      {
        href: "/parents",
        label: "Ota-onalar",
        icon: Users2,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        href: "/admins",
        label: "Adminlar",
        icon: ShieldUser,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        href: "/groups",
        label: "Guruhlar",
        icon: School,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"],
      },
    ],
  },
  {
    id: "learning",
    label: "O'QUV JARAYONI",
    items: [
      {
        href: "/rooms",
        label: "Xonalar",
        icon: Building2,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"],
      },
      {
        href: "/courses",
        label: "Kurslar",
        icon: BookOpen,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER"],
      },
      {
        href: "/timetable",
        label: "Dars jadvali",
        icon: CalendarDays,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT", "STAFF"],
      },
    ],
  },
  {
    id: "results",
    label: "NATIJALAR",
    items: [
      {
        href: "/attendance",
        label: "Davomat",
        icon: SquareActivity,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"],
      },
      {
        href: "/staff-attendance",
        label: "Xodimlar davomati",
        icon: UserRoundCheck,
        roles: ["SUPER_ADMIN", "ADMIN", "STAFF"],
      },
      {
        href: "/ratings",
        label: "Reyting",
        icon: PercentCircle,
        roles: ["SUPER_ADMIN", "ADMIN", "TEACHER", "STUDENT"],
      },
      {
        href: "/payments",
        label: "To'lovlar",
        icon: CreditCard,
        roles: ["SUPER_ADMIN", "ADMIN", "PARENT", "STUDENT"],
      },
    ],
  },
  {
    id: "management",
    label: "BOSHQARUV",
    collapsible: true,
    items: [
      {
        href: "/settings",
        label: "O'quv markaz",
        icon: Settings2,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        href: "/tariffs",
        label: "Tariflar",
        icon: ShieldUser,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        href: "/sms",
        label: "SMS",
        icon: MessageSquareText,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },
  {
    id: "analytics",
    label: "TAHLIL",
    collapsible: true,
    items: [
      {
        href: "/branches",
        label: "Filiallar",
        icon: Building2,
        roles: ["SUPER_ADMIN"],
      },
      {
        href: "/finance",
        label: "Moliya",
        icon: Wallet,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        href: "/action-logs",
        label: "Action loglar",
        icon: LayoutDashboard,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
      {
        href: "/error-logs",
        label: "Error loglar",
        icon: ShieldAlert,
        roles: ["SUPER_ADMIN", "ADMIN"],
      },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    management: true,
    analytics: false,
  });

  const visibleSections = useMemo(() => {
    if (!user) return [];
    return NAV_SECTIONS.map((section) => ({
      ...section,
      items: section.items.filter((item) => item.roles.includes(user.role)),
    })).filter((section) => section.items.length > 0);
  }, [user]);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((p) => p[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <aside
      style={{
        width: 236,
        flexShrink: 0,
        height: "100vh",
        position: "sticky",
        top: 0,
        background: "#f4f7fe",
        borderRight: "1px solid #e4e9f5",
        padding: "10px 8px",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      {/* Inner white card */}
      <div
        style={{
          flex: 1,
          background: "#ffffff",
          borderRadius: 18,
          boxShadow: "0 4px 24px -12px rgba(30,50,120,0.18)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          padding: "10px 8px",
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            padding: "4px 8px 12px",
            borderBottom: "1px solid #f0f3fb",
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: 10,
              background: "linear-gradient(135deg, #4158ca 0%, #8342ef 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              flexShrink: 0,
            }}
          >
            AI
          </div>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: "#1e2340", margin: 0 }}>AI solo</p>
            <p style={{ fontWeight: 400, fontSize: 10, color: "#8a96b8", margin: 0 }}>Academy Panel</p>
          </div>
        </div>

        {/* Nav items */}
        <div style={{ flex: 1, overflowY: "auto", paddingRight: 2 }}>
          {visibleSections.map((section) => {
            const isOpen = expandedSections[section.id] ?? true;

            const sectionBody = (
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {section.items.map((item) => {
                  const active =
                    pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 9,
                        padding: "7px 10px",
                        borderRadius: 11,
                        fontSize: 13,
                        fontWeight: active ? 600 : 500,
                        color: active ? "#ffffff" : "#5a6388",
                        textDecoration: "none",
                        background: active
                          ? "linear-gradient(98deg, #2f66f4 0%, #4356e8 45%, #8342ef 100%)"
                          : "transparent",
                        boxShadow: active
                          ? "0 4px 14px -6px rgba(63,86,210,0.55)"
                          : "none",
                        transition: "background 0.15s, color 0.15s",
                      }}
                      onMouseEnter={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = "#eef2ff";
                          (e.currentTarget as HTMLElement).style.color = "#2d3882";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!active) {
                          (e.currentTarget as HTMLElement).style.background = "transparent";
                          (e.currentTarget as HTMLElement).style.color = "#5a6388";
                        }
                      }}
                    >
                      <Icon
                        style={{
                          width: 16,
                          height: 16,
                          color: active ? "#ffffff" : "#8896c0",
                          flexShrink: 0,
                        }}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            );

            return (
              <div key={section.id} style={{ marginBottom: 12 }}>
                {section.label ? (
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.12em",
                      color: "#b0bace",
                      padding: "0 10px",
                      marginBottom: 4,
                      textTransform: "uppercase",
                    }}
                  >
                    {section.label}
                  </p>
                ) : null}

                {section.collapsible ? (
                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSections((prev) => ({
                          ...prev,
                          [section.id]: !isOpen,
                        }))
                      }
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: 11,
                        fontSize: 13,
                        fontWeight: 600,
                        color: "#4a5678",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginBottom: 2,
                      }}
                    >
                      <span>{section.id === "management" ? "Boshqaruv" : "Tahlil"}</span>
                      <ChevronDown
                        style={{
                          width: 15,
                          height: 15,
                          transition: "transform 0.2s",
                          transform: isOpen ? "rotate(180deg)" : "rotate(0)",
                        }}
                      />
                    </button>
                    {isOpen ? sectionBody : null}
                  </div>
                ) : (
                  sectionBody
                )}
              </div>
            );
          })}
        </div>

        {/* Help & User footer */}
        <div style={{ borderTop: "1px solid #f0f3fb", paddingTop: 10, marginTop: 4 }}>
          {/* Help */}
          <Link
            href="#"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 9,
              padding: "7px 10px",
              borderRadius: 11,
              fontSize: 13,
              fontWeight: 500,
              color: "#5a6388",
              textDecoration: "none",
              marginBottom: 8,
            }}
          >
            <HelpCircle style={{ width: 16, height: 16, color: "#8896c0" }} />
            <span>Qo&apos;llab-quvvatlash</span>
          </Link>

          {/* User */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 8px",
              borderRadius: 12,
              background: "#f5f7fd",
            }}
          >
            <Avatar style={{ width: 36, height: 36, flexShrink: 0 }}>
              <AvatarFallback
                style={{
                  background: "linear-gradient(135deg, #eef1ff, #e0e5ff)",
                  color: "#4158ca",
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                {initials}
              </AvatarFallback>
            </Avatar>
            <div style={{ minWidth: 0, flex: 1 }}>
              <p
                style={{
                  fontWeight: 600,
                  fontSize: 12.5,
                  color: "#1e2340",
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.name}
              </p>
              <p
                style={{
                  fontSize: 10.5,
                  color: "#8a96b8",
                  margin: 0,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {user.role}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              style={{
                width: 30,
                height: 30,
                borderRadius: 8,
                color: "#8a96b8",
                flexShrink: 0,
              }}
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              <LogOut style={{ width: 15, height: 15 }} />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
}
