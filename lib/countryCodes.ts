// Karochat — country dial codes for the phone field (Wave 22).
// Values are "<ISO>:<dial>" so duplicate dial codes (e.g. +1 US/CA) stay
// unique in a <select>. India is first (default).

export type Country = { iso: string; name: string; dial: string; flag: string };

export const COUNTRY_CODES: Country[] = [
  { iso: "IN", name: "India", dial: "+91", flag: "🇮🇳" },
  { iso: "US", name: "United States", dial: "+1", flag: "🇺🇸" },
  { iso: "GB", name: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { iso: "CA", name: "Canada", dial: "+1", flag: "🇨🇦" },
  { iso: "AU", name: "Australia", dial: "+61", flag: "🇦🇺" },
  { iso: "AE", name: "United Arab Emirates", dial: "+971", flag: "🇦🇪" },
  { iso: "SA", name: "Saudi Arabia", dial: "+966", flag: "🇸🇦" },
  { iso: "SG", name: "Singapore", dial: "+65", flag: "🇸🇬" },
  { iso: "MY", name: "Malaysia", dial: "+60", flag: "🇲🇾" },
  { iso: "QA", name: "Qatar", dial: "+974", flag: "🇶🇦" },
  { iso: "KW", name: "Kuwait", dial: "+965", flag: "🇰🇼" },
  { iso: "OM", name: "Oman", dial: "+968", flag: "🇴🇲" },
  { iso: "BH", name: "Bahrain", dial: "+973", flag: "🇧🇭" },
  { iso: "NP", name: "Nepal", dial: "+977", flag: "🇳🇵" },
  { iso: "BD", name: "Bangladesh", dial: "+880", flag: "🇧🇩" },
  { iso: "LK", name: "Sri Lanka", dial: "+94", flag: "🇱🇰" },
  { iso: "PK", name: "Pakistan", dial: "+92", flag: "🇵🇰" },
  { iso: "ID", name: "Indonesia", dial: "+62", flag: "🇮🇩" },
  { iso: "PH", name: "Philippines", dial: "+63", flag: "🇵🇭" },
  { iso: "TH", name: "Thailand", dial: "+66", flag: "🇹🇭" },
  { iso: "VN", name: "Vietnam", dial: "+84", flag: "🇻🇳" },
  { iso: "JP", name: "Japan", dial: "+81", flag: "🇯🇵" },
  { iso: "KR", name: "South Korea", dial: "+82", flag: "🇰🇷" },
  { iso: "CN", name: "China", dial: "+86", flag: "🇨🇳" },
  { iso: "HK", name: "Hong Kong", dial: "+852", flag: "🇭🇰" },
  { iso: "NZ", name: "New Zealand", dial: "+64", flag: "🇳🇿" },
  { iso: "IE", name: "Ireland", dial: "+353", flag: "🇮🇪" },
  { iso: "DE", name: "Germany", dial: "+49", flag: "🇩🇪" },
  { iso: "FR", name: "France", dial: "+33", flag: "🇫🇷" },
  { iso: "ES", name: "Spain", dial: "+34", flag: "🇪🇸" },
  { iso: "IT", name: "Italy", dial: "+39", flag: "🇮🇹" },
  { iso: "PT", name: "Portugal", dial: "+351", flag: "🇵🇹" },
  { iso: "NL", name: "Netherlands", dial: "+31", flag: "🇳🇱" },
  { iso: "SE", name: "Sweden", dial: "+46", flag: "🇸🇪" },
  { iso: "CH", name: "Switzerland", dial: "+41", flag: "🇨🇭" },
  { iso: "RU", name: "Russia", dial: "+7", flag: "🇷🇺" },
  { iso: "TR", name: "Türkiye", dial: "+90", flag: "🇹🇷" },
  { iso: "ZA", name: "South Africa", dial: "+27", flag: "🇿🇦" },
  { iso: "NG", name: "Nigeria", dial: "+234", flag: "🇳🇬" },
  { iso: "KE", name: "Kenya", dial: "+254", flag: "🇰🇪" },
  { iso: "GH", name: "Ghana", dial: "+233", flag: "🇬🇭" },
  { iso: "EG", name: "Egypt", dial: "+20", flag: "🇪🇬" },
  { iso: "MA", name: "Morocco", dial: "+212", flag: "🇲🇦" },
  { iso: "BR", name: "Brazil", dial: "+55", flag: "🇧🇷" },
  { iso: "MX", name: "Mexico", dial: "+52", flag: "🇲🇽" },
  { iso: "AR", name: "Argentina", dial: "+54", flag: "🇦🇷" }
];

export const DEFAULT_COUNTRY_VALUE = "IN:+91";

/** Returns the dial part of a "<ISO>:<dial>" select value. */
export function dialOf(value: string): string {
  return value.split(":")[1] ?? value;
}

/** Maps an ISO country code (e.g. "IN") to a select value, or null. */
export function valueForIso(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const c = COUNTRY_CODES.find((x) => x.iso === iso.toUpperCase());
  return c ? `${c.iso}:${c.dial}` : null;
}

/**
 * Normalises a typed phone number to just the LOCAL digits — strips a leading
 * "+", and a leading copy of the selected dial code, so prefixing the dial
 * again never duplicates it.
 */
export function localPhone(raw: string, dial: string): string {
  const digits = (raw || "").replace(/\D/g, "");
  const dd = (dial || "").replace(/\D/g, "");
  if (dd && digits.startsWith(dd)) return digits.slice(dd.length);
  return digits;
}

/** Strips a leading "+<code> " prefix for display (when reloading a saved value). */
export function stripLeadingCode(raw: string): string {
  return (raw || "").replace(/^\s*\+\d{1,4}[\s-]*/, "").trim();
}

/** A valid email (basic, permissive — any real address passes). */
export function isValidEmail(email: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test((email || "").trim());
}

/** A valid phone: 6–15 local digits (E.164 allows up to 15 incl. country code). */
export function isValidPhone(local: string): boolean {
  return /^\d{6,15}$/.test(local || "");
}
