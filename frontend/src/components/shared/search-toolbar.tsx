"use client";

import { Search, Filter, LayoutGrid, List } from "lucide-react";

type SearchToolbarProps = {
  value?: string;
  onChange?: (val: string) => void;
  placeholder?: string;
  onFilter?: () => void;
  filterLabel?: string;
  view?: "grid" | "list";
  onViewChange?: (v: "grid" | "list") => void;
  actions?: React.ReactNode;
};

export function SearchToolbar({
  value,
  onChange,
  placeholder = "Qidirish...",
  onFilter,
  filterLabel = "Filtrlash",
  view,
  onViewChange,
  actions,
}: SearchToolbarProps) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #ffffff 0%, #f8fbff 100%)",
        border: "1px solid #dce5fa",
        borderRadius: 14,
        padding: "10px 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        boxShadow: "0 8px 20px -14px rgba(49,84,184,0.35)",
      }}
    >
      {/* Search */}
      <div style={{ position: "relative", flex: 1, maxWidth: 400 }}>
        <Search
          style={{
            position: "absolute",
            left: 11,
            top: "50%",
            transform: "translateY(-50%)",
            width: 15,
            height: 15,
            color: "#9ba8c8",
            pointerEvents: "none",
          }}
        />
        <input
          type="text"
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          placeholder={placeholder}
          style={{
            width: "100%",
            height: 36,
            paddingLeft: 34,
            paddingRight: 12,
            borderRadius: 10,
            border: "1.5px solid #dbe4f8",
            background: "#f6f9ff",
            fontSize: 13,
            color: "#1e2340",
            outline: "none",
            transition: "border-color 0.15s",
          }}
          onFocus={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "#5068d8";
            (e.target as HTMLInputElement).style.boxShadow = "0 0 0 3px rgba(80,104,216,0.12)";
          }}
          onBlur={(e) => {
            (e.target as HTMLInputElement).style.borderColor = "#e0e7f5";
            (e.target as HTMLInputElement).style.boxShadow = "none";
          }}
        />
      </div>

      {/* Right controls */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {onFilter ? (
          <button
            type="button"
            onClick={onFilter}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              height: 36,
              padding: "0 14px",
              borderRadius: 10,
              border: "1.5px solid #d5e0fb",
              background: "linear-gradient(180deg, #f7faff 0%, #edf2ff 100%)",
              fontSize: 13,
              fontWeight: 600,
              color: "#3e4faa",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <Filter style={{ width: 14, height: 14 }} />
            {filterLabel}
          </button>
        ) : null}

        {onViewChange ? (
          <div
            style={{
              display: "flex",
              background: "#f0f4ff",
              borderRadius: 10,
              padding: 2,
              gap: 2,
            }}
          >
            {(["grid", "list"] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => onViewChange(v)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: "none",
                  background: view === v ? "#ffffff" : "transparent",
                  boxShadow: view === v ? "0 1px 4px rgba(30,50,120,0.12)" : "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  color: view === v ? "#4158ca" : "#8898c0",
                  transition: "all 0.15s",
                }}
              >
                {v === "grid" ? (
                  <LayoutGrid style={{ width: 15, height: 15 }} />
                ) : (
                  <List style={{ width: 15, height: 15 }} />
                )}
              </button>
            ))}
          </div>
        ) : null}

        {actions}
      </div>
    </div>
  );
}
