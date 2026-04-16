"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, ChevronDown, Languages, LogOut, Settings2 } from "lucide-react";
import { useAuthStore } from "@/lib/auth-store";
import { branchesApi } from "@/lib/api/services";
import { ApiError } from "@/lib/api/client";
import {
  BRANCH_CHANGED_EVENT,
  BRANCHES_UPDATED_EVENT,
  getActiveBranchId,
  setActiveBranchId,
} from "@/lib/api/auth-storage";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type TopNavProps = {
  title?: string;
  description?: string;
};

type BranchOption = {
  id: string;
  name: string;
};

const LANGUAGES = [
  { id: "uz", label: "O'zbek", flag: "uz" },
  { id: "ru", label: "Rus", flag: "ru" },
  { id: "en", label: "English", flag: "en" },
];

export function TopNav({ title, description }: TopNavProps) {
  const router = useRouter();
  const { user, logout } = useAuthStore();
  const [branchOptions, setBranchOptions] = useState<BranchOption[]>([]);
  const [activeBranchId, setBranchId] = useState<string>("");
  const [activeLanguage, setActiveLanguage] = useState("uz");

  const loadBranches = useCallback(async () => {
    if (!user) {
      setBranchOptions([]);
      setBranchId("");
      return;
    }

    try {
      const response = await branchesApi.list({ page: 1, limit: 100, status: "ACTIVE" });
      const options = (response.data as Array<{ id: string; name: string }>).map((item) => ({
        id: item.id,
        name: item.name,
      }));
      setBranchOptions(options);

      const persisted = getActiveBranchId();
      const fallback = user.branchId ?? options[0]?.id ?? "";
      const selected =
        persisted && options.some((item) => item.id === persisted) ? persisted : fallback;

      setBranchId(selected);
      if (selected && selected !== persisted) {
        setActiveBranchId(selected);
      }
    } catch (error) {
      setBranchOptions([]);

      if (user.branchId) {
        setBranchOptions([{ id: user.branchId, name: "Asosiy filial" }]);
        setBranchId(user.branchId);
        setActiveBranchId(user.branchId);
        return;
      }

      setBranchId("");

      if (error instanceof ApiError) {
        // Keep branch picker stable on API errors.
      }
    }
  }, [user]);

  useEffect(() => {
    void loadBranches();
  }, [loadBranches]);

  useEffect(() => {
    const onBranchesUpdated = () => {
      void loadBranches();
    };
    const onBranchChanged = () => {
      const current = getActiveBranchId() ?? "";
      setBranchId(current);
    };

    window.addEventListener(BRANCHES_UPDATED_EVENT, onBranchesUpdated);
    window.addEventListener(BRANCH_CHANGED_EVENT, onBranchChanged);

    return () => {
      window.removeEventListener(BRANCHES_UPDATED_EVENT, onBranchesUpdated);
      window.removeEventListener(BRANCH_CHANGED_EVENT, onBranchChanged);
    };
  }, [loadBranches]);

  const activeBranchLabel = useMemo(() => {
    if (!activeBranchId) return "Asosiy filial";
    return branchOptions.find((item) => item.id === activeBranchId)?.name ?? "Asosiy filial";
  }, [activeBranchId, branchOptions]);

  if (!user) return null;

  const initials = user.name
    .split(" ")
    .map((x) => x[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const activeLang = LANGUAGES.find((l) => l.id === activeLanguage);

  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 30,
        background: "rgba(255,255,255,0.92)",
        backdropFilter: "blur(12px)",
        borderBottom: "1px solid #e8edf8",
        padding: "0 20px",
        height: 56,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
      }}
    >
      {/* Page title */}
      <div>
        <p style={{ fontWeight: 600, fontSize: 14, color: "#1e2340", margin: 0, lineHeight: 1.3 }}>
          {title ?? "Academy dashboard"}
        </p>
        {description ? (
          <p style={{ fontSize: 11.5, color: "#8a96b4", margin: 0, lineHeight: 1.3 }}>
            {description}
          </p>
        ) : null}
      </div>

      {/* Right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>

        {/* Branch selector */}
        <DropdownMenu>
          <DropdownMenuTrigger
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                height: 36,
                padding: "0 12px",
                borderRadius: 10,
                border: "1.5px solid #e0e7f5",
                background: "#f7f9ff",
                fontSize: 12.5,
                fontWeight: 500,
                color: "#3a4470",
                cursor: "pointer",
                outline: "none",
                transition: "border-color 0.15s",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 18,
                  height: 18,
                  borderRadius: 4,
                  background: "linear-gradient(135deg, #4158ca, #8342ef)",
                  color: "#fff",
                  fontSize: 9,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                F
              </span>
              <span style={{ maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {activeBranchLabel}
              </span>
              <ChevronDown style={{ width: 14, height: 14, color: "#8898c0" }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ minWidth: 200, borderRadius: 14, border: "1px solid #e4ecf8", background: "#fff" }}>
            {branchOptions.length ? (
              branchOptions.map((branch) => (
                <DropdownMenuItem
                  key={branch.id}
                  onClick={() => {
                    if (branch.id === activeBranchId) return;
                    setBranchId(branch.id);
                    setActiveBranchId(branch.id);
                  }}
                  style={{ fontSize: 13, display: "flex", justifyContent: "space-between" }}
                >
                  <span>{branch.name}</span>
                  {activeBranchId === branch.id ? (
                    <Check style={{ width: 14, height: 14, color: "#4f63de" }} />
                  ) : null}
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>Filiallar mavjud emas</DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Language selector */}
        <DropdownMenu>
          <DropdownMenuTrigger
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                height: 36,
                padding: "0 10px",
                borderRadius: 10,
                border: "1.5px solid #e0e7f5",
                background: "#f7f9ff",
                fontSize: 12.5,
                fontWeight: 500,
                color: "#3a4470",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <Languages style={{ width: 15, height: 15, color: "#637098" }} />
              <span>{activeLang?.label ?? "O'zbek"}</span>
              <ChevronDown style={{ width: 13, height: 13, color: "#8898c0" }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" style={{ minWidth: 160, borderRadius: 14, border: "1px solid #e4ecf8", background: "#fff" }}>
            {LANGUAGES.map((lang) => (
              <DropdownMenuItem
                key={lang.id}
                onClick={() => setActiveLanguage(lang.id)}
                style={{ fontSize: 13, display: "flex", justifyContent: "space-between" }}
              >
                <span>{lang.label}</span>
                {activeLanguage === lang.id ? (
                  <Check style={{ width: 14, height: 14, color: "#4f63de" }} />
                ) : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* User avatar dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 40,
                padding: "0 10px 0 6px",
                borderRadius: 12,
                border: "1.5px solid #e0e7f5",
                background: "#fff",
                cursor: "pointer",
                outline: "none",
                transition: "background 0.15s",
              }}
            >
              <div
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "linear-gradient(135deg, #eef1ff, #e0e5ff)",
                  color: "#4158ca",
                  fontWeight: 700,
                  fontSize: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div style={{ textAlign: "left" }}>
                <p
                  style={{
                    fontWeight: 600,
                    fontSize: 12.5,
                    color: "#1e2340",
                    margin: 0,
                    lineHeight: 1.25,
                    maxWidth: 100,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {user.name}
                </p>
                <p
                  style={{
                    fontSize: 10.5,
                    color: "#8a96b4",
                    margin: 0,
                    lineHeight: 1.25,
                  }}
                >
                  {user.role === "SUPER_ADMIN" ? "Direktor" : user.role}
                </p>
              </div>
              <ChevronDown style={{ width: 14, height: 14, color: "#8898c0" }} />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            style={{ minWidth: 200, borderRadius: 14, border: "1px solid #e4ecf8", background: "#fff" }}
          >
            <DropdownMenuItem
              onClick={() => router.push("/settings")}
              style={{ fontSize: 13 }}
            >
              <Settings2 style={{ width: 15, height: 15, marginRight: 8, color: "#637098" }} />
              Sozlamalar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              style={{ fontSize: 13, color: "#c02040" }}
              onClick={async () => {
                await logout();
                router.replace("/login");
              }}
            >
              <LogOut style={{ width: 15, height: 15, marginRight: 8 }} />
              Chiqish
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
