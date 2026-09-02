import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import * as Icons from "lucide-react";

/**
 * Serialises the same lucide icon the canvas draws into inline SVG markup so
 * exports carry identical glyphs. Results are cached per (name, size, colour).
 */

type IconComponent = React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;

const cache = new Map<string, string>();

export function hasIcon(name: string): boolean {
  return typeof (Icons as unknown as Record<string, unknown>)[name] === "function" || name in Icons;
}

export function iconMarkup(name: string, size: number, color: string, strokeWidth = 2): string {
  const key = `${name}|${size}|${color}|${strokeWidth}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const set = Icons as unknown as Record<string, IconComponent>;
  const Component = set[name] ?? Icons.Box;
  let markup = "";
  try {
    markup = renderToStaticMarkup(createElement(Component, { size, color, strokeWidth }));
  } catch {
    markup = "";
  }
  // Drop React-only / a11y attributes so the fragment stays minimal and valid inside another <svg>.
  markup = markup.replace(/\s(class|aria-hidden)="[^"]*"/g, "");
  cache.set(key, markup);
  return markup;
}
