import raw from "../tokens.json";

const px = (n: number) => `${n}px`;

/**
 * Tailwind preset (v3-style `theme.extend`) for consumers that use JS config, e.g. NativeWind on Expo.
 * The web app (Tailwind v4) consumes the equivalent CSS variables in `theme.css`.
 */
export const tailwindPreset = {
  theme: {
    extend: {
      colors: {
        brand: {
          primary: raw.color.brand.primary,
          "primary-hover": raw.color.brand.primaryHover,
          bright: raw.color.brand.bright,
          cyan: raw.color.brand.cyan,
        },
        ink: { DEFAULT: raw.color.text.primary, muted: raw.color.text.secondary, inverse: raw.color.text.inverse },
        surface: { page: raw.color.surface.page, card: raw.color.surface.card, tint: raw.color.surface.tint },
        line: { DEFAULT: raw.color.border.default, strong: raw.color.border.strong },
        success: { DEFAULT: raw.color.state.success, bg: raw.color.state.successBg },
        danger: { DEFAULT: raw.color.state.error, bg: raw.color.state.errorBg },
        warning: { DEFAULT: raw.color.state.warning, bg: raw.color.state.warningBg },
      },
      borderRadius: { card: px(raw.radius.card), control: px(raw.radius.control), pill: px(raw.radius.pill) },
      fontFamily: { sans: [raw.font.family], mono: [raw.font.mono] },
      maxWidth: { content: px(raw.size.contentMax), reading: px(raw.size.readingMax) },
      width: { sidebar: px(raw.size.sidebar) },
      minHeight: { control: px(raw.size.control), "control-min": px(raw.size.controlMin) },
      boxShadow: { card: raw.shadow.card, raised: raw.shadow.raised },
      screens: { md: px(raw.breakpoint.tablet), lg: px(raw.breakpoint.desktop) },
    },
  },
} as const;

export default tailwindPreset;
