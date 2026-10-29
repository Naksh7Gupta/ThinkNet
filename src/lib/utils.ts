import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function parseApiError(payload: unknown, status: number): string {
  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((item) => {
          if (typeof item === "string") return item;
          if (item && typeof item === "object" && "msg" in item) {
            return String((item as { msg: unknown }).msg);
          }
          return JSON.stringify(item);
        })
        .join("\n");
    }
    if (detail && typeof detail === "object" && "errors" in detail) {
      const errors = (detail as { errors: unknown }).errors;
      if (Array.isArray(errors)) return errors.map(String).join("\n");
    }
    return JSON.stringify(detail);
  }
  return `Request failed (${status})`;
}
