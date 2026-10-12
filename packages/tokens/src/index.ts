import raw from "../tokens.json";

export const tokens = raw;
export type Tokens = typeof raw;

export const colors = raw.color;
export const space = raw.space;
export const radius = raw.radius;
export const sizes = raw.size;
export const breakpoints = raw.breakpoint;
export const font = raw.font;

export { tailwindPreset } from "./tailwind-preset";
