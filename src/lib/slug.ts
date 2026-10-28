// "Sorry Mom Hoodie" -> "sorry-mom-hoodie"
// Accents are folded ("Café" -> "cafe") and anything that isn't a letter or a
// digit becomes a hyphen, so the result is safe in a URL.
export const slugify = (value: string): string =>
  value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
