export type StatusKey =
  | "pending_confirmation"
  | "pending"
  | "assigned"
  | "picked_up"
  | "delivering"
  | "completed"
  | "failed"
  | "cancelled"
  | "rejected";

export interface ColorPalette {
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primaryText: string;
  danger: string;
  dangerBg: string;
  dangerFg: string;
  success: string;
  successBg: string;
  successFg: string;
  warning: string;
  warningBg: string;
  warningFg: string;
  info: string;
  infoBg: string;
  infoFg: string;
  neutralBg: string;
  neutralFg: string;
  overlay: string;
}

export const light: ColorPalette = {
  background: "#f1f5f9",
  surface: "#ffffff",
  surfaceAlt: "#f8fafc",
  border: "#e2e8f0",
  text: "#0f172a",
  textMuted: "#64748b",
  textInverse: "#ffffff",
  primary: "#0f172a",
  primaryText: "#ffffff",
  danger: "#dc2626",
  dangerBg: "#fee2e2",
  dangerFg: "#b91c1c",
  success: "#16a34a",
  successBg: "#dcfce7",
  successFg: "#15803d",
  warning: "#f59e0b",
  warningBg: "#fef3c7",
  warningFg: "#b45309",
  info: "#3b82f6",
  infoBg: "#dbeafe",
  infoFg: "#1d4ed8",
  neutralBg: "#e2e8f0",
  neutralFg: "#475569",
  overlay: "rgba(15, 23, 42, 0.4)",
};

export const dark: ColorPalette = {
  background: "#0b1220",
  surface: "#161f30",
  surfaceAlt: "#1c2740",
  border: "#2a3650",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textInverse: "#0f172a",
  primary: "#e2e8f0",
  primaryText: "#0f172a",
  danger: "#f87171",
  dangerBg: "#3f1d1d",
  dangerFg: "#fca5a5",
  success: "#4ade80",
  successBg: "#123a24",
  successFg: "#86efac",
  warning: "#fbbf24",
  warningBg: "#3f2d0c",
  warningFg: "#fcd34d",
  info: "#60a5fa",
  infoBg: "#152a4d",
  infoFg: "#93c5fd",
  neutralBg: "#2a3650",
  neutralFg: "#cbd5e1",
  overlay: "rgba(0, 0, 0, 0.6)",
};

export const STATUS_META: Record<
  StatusKey,
  { tone: "warning" | "info" | "success" | "danger" | "neutral"; icon: string }
> = {
  pending_confirmation: { tone: "warning", icon: "time-outline" },
  pending: { tone: "warning", icon: "time-outline" },
  assigned: { tone: "info", icon: "bicycle-outline" },
  picked_up: { tone: "info", icon: "cube-outline" },
  delivering: { tone: "info", icon: "navigate-outline" },
  completed: { tone: "success", icon: "checkmark-circle" },
  failed: { tone: "danger", icon: "close-circle" },
  cancelled: { tone: "neutral", icon: "ban-outline" },
  rejected: { tone: "danger", icon: "close-circle" },
};

export function statusColors(palette: ColorPalette, status: string) {
  const meta = STATUS_META[status as StatusKey];
  const tone = meta?.tone ?? "neutral";
  const map = {
    warning: { bg: palette.warningBg, fg: palette.warningFg },
    info: { bg: palette.infoBg, fg: palette.infoFg },
    success: { bg: palette.successBg, fg: palette.successFg },
    danger: { bg: palette.dangerBg, fg: palette.dangerFg },
    neutral: { bg: palette.neutralBg, fg: palette.neutralFg },
  } as const;
  return { ...map[tone], icon: meta?.icon ?? "ellipse-outline" };
}
