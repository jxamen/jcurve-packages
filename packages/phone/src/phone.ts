/** Phone display helpers only. Identity verification belongs to @jcurve/identity. */
export const digits = (value: string): string => value.replace(/\D/g, '');
export function format(value: string): string {
  const d = digits(value).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
export const looksValid = (value: string): boolean => /^01[016789]\d{7,8}$/.test(digits(value));
