export function generateSubjectCode(name: string) {
  const words = name
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 3).toLocaleUpperCase("id-ID");
  if (words.length === 2) {
    return `${words[0][0]}${words[1].slice(0, 2)}`.toLocaleUpperCase("id-ID");
  }
  return words.map((word) => word[0]).join("").toLocaleUpperCase("id-ID");
}
