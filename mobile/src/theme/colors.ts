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
  background: "#f5f5f5",
  surface: "#ffffff",
  surfaceAlt: "#fafafa",
  border: "#d9d9d9",
  text: "rgba(0, 0, 0, 0.88)",
  textMuted: "rgba(0, 0, 0, 0.45)",
  textInverse: "#ffffff",
  primary: "#1677ff",
  primaryText: "#ffffff",
  danger: "#ff4d4f",
  dangerBg: "#fff2f0",
  dangerFg: "#cf1322",
  success: "#52c41a",
  successBg: "#f6ffed",
  successFg: "#389e0d",
  warning: "#faad14",
  warningBg: "#fffbe6",
  warningFg: "#d48806",
  info: "#1677ff",
  infoBg: "#e6f4ff",
  infoFg: "#0958d9",
  neutralBg: "#fafafa",
  neutralFg: "rgba(0, 0, 0, 0.65)",
  overlay: "rgba(0, 0, 0, 0.45)",
};

export const dark: ColorPalette = {
  background: "#000000",
  surface: "#1f1f1f",
  surfaceAlt: "#262626",
  border: "#424242",
  text: "rgba(255, 255, 255, 0.85)",
  textMuted: "rgba(255, 255, 255, 0.45)",
  textInverse: "rgba(0, 0, 0, 0.88)",
  primary: "#1668dc",
  primaryText: "#ffffff",
  danger: "#dc4446",
  dangerBg: "#2c1618",
  dangerFg: "#e84749",
  success: "#49aa19",
  successBg: "#162312",
  successFg: "#49aa19",
  warning: "#d89614",
  warningBg: "#2b2111",
  warningFg: "#d89614",
  info: "#1668dc",
  infoBg: "#111a2c",
  infoFg: "#3c89e8",
  neutralBg: "#262626",
  neutralFg: "rgba(255, 255, 255, 0.65)",
  overlay: "rgba(0, 0, 0, 0.65)",
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

// Ant Design Tag border tints — a Tag is bg + 1px border in the same tone, not a
// solid fill, so these are kept separate from the bg/fg pair above.
const TAG_BORDER = {
  light: {
    warning: "#ffe58f",
    info: "#91caff",
    success: "#b7eb8f",
    danger: "#ffccc7",
    neutral: "#d9d9d9",
  },
  dark: {
    warning: "#594214",
    info: "#15325b",
    success: "#274916",
    danger: "#58181c",
    neutral: "#424242",
  },
} as const;

export function statusColors(palette: ColorPalette, status: string) {
  const meta = STATUS_META[status as StatusKey];
  const tone = meta?.tone ?? "neutral";
  const scheme = palette === dark ? "dark" : "light";
  const map = {
    warning: { bg: palette.warningBg, fg: palette.warningFg },
    info: { bg: palette.infoBg, fg: palette.infoFg },
    success: { bg: palette.successBg, fg: palette.successFg },
    danger: { bg: palette.dangerBg, fg: palette.dangerFg },
    neutral: { bg: palette.neutralBg, fg: palette.neutralFg },
  } as const;
  return { ...map[tone], border: TAG_BORDER[scheme][tone], icon: meta?.icon ?? "ellipse-outline" };
}
