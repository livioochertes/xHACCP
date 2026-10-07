import { parse as parseCsv } from "csv-parse/sync";

export type ProspectCsvRow = {
  email: string;
  restaurantName: string | null;
  city: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  foodSafetyNote: string | null;
  legalRepresentative: string | null;
  siret: string | null;
  source: string | null;
};

export type ProspectCsvParseResult = {
  rows: ProspectCsvRow[];
  totalRows: number;
  invalidRows: number;
  duplicateRows: number;
  sample: ProspectCsvRow[];
};

const HEADER_ALIASES: Record<keyof ProspectCsvRow, string[]> = {
  email: ["email", "e mail", "courriel"],
  restaurantName: ["nume restaurant", "nom restaurant", "nom du restaurant", "restaurant"],
  city: ["oras", "ville", "city"],
  address: ["adresa", "adresse", "address"],
  phone: ["telefon", "telephone", "phone"],
  website: ["site web", "site internet", "website", "site"],
  foodSafetyNote: ["nota alimconfiance", "note alimconfiance", "alimconfiance"],
  legalRepresentative: ["reprezentant legal", "representant legal", "dirigeant", "legal representative"],
  siret: ["siret"],
  source: ["sursa", "source"],
};

function normalizeHeader(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[’']/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function detectDelimiter(input: string): string {
  let firstRecord = "";
  let inQuotes = false;
  for (let index = 0; index < input.length; index++) {
    const char = input[index];
    if (char === '"') {
      if (inQuotes && input[index + 1] === '"') {
        firstRecord += '""';
        index++;
        continue;
      }
      inQuotes = !inQuotes;
    }
    if (!inQuotes && (char === "\n" || char === "\r")) break;
    firstRecord += char;
  }

  const candidates = [",", ";", "\t"];
  return candidates
    .map((delimiter) => {
      let count = 0;
      inQuotes = false;
      for (let index = 0; index < firstRecord.length; index++) {
        const char = firstRecord[index];
        if (char === '"') {
          if (inQuotes && firstRecord[index + 1] === '"') {
            index++;
            continue;
          }
          inQuotes = !inQuotes;
        } else if (!inQuotes && char === delimiter) {
          count++;
        }
      }
      return { delimiter, count };
    })
    .sort((left, right) => right.count - left.count)[0].delimiter;
}

function cleanCell(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\u0000/g, "").trim();
  return cleaned ? cleaned.slice(0, maxLength) : null;
}

function isValidEmail(email: string): boolean {
  return email.length <= 255 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function parseProspectCsv(input: string): ProspectCsvParseResult {
  const content = input.replace(/^\uFEFF/, "");
  if (!content.trim()) throw new Error("The CSV file is empty");

  const records = parseCsv(content, {
    bom: true,
    delimiter: detectDelimiter(content),
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
    max_record_size: 64 * 1024,
  }) as string[][];

  if (records.length < 2) throw new Error("The CSV file must contain a header and at least one contact");
  const headers = records[0].map(normalizeHeader);
  const columnIndexes = Object.fromEntries(
    Object.entries(HEADER_ALIASES).map(([field, aliases]) => [
      field,
      headers.findIndex((header) => aliases.includes(header)),
    ]),
  ) as Record<keyof ProspectCsvRow, number>;

  if (columnIndexes.email < 0) throw new Error("The CSV file must contain an Email column");
  const totalRows = records.length - 1;
  if (totalRows > 10_000) throw new Error("A single import can contain at most 10,000 rows");

  const rows: ProspectCsvRow[] = [];
  const seenEmails = new Set<string>();
  let invalidRows = 0;
  let duplicateRows = 0;

  for (const record of records.slice(1)) {
    if (record.every((cell) => !String(cell ?? "").trim())) continue;
    const rawEmail = record[columnIndexes.email] || "";
    const email = rawEmail.trim().toLowerCase();
    if (!isValidEmail(email)) {
      invalidRows++;
      continue;
    }
    if (seenEmails.has(email)) {
      duplicateRows++;
      continue;
    }
    seenEmails.add(email);

    const get = (field: keyof ProspectCsvRow, maxLength: number): string | null => {
      const index = columnIndexes[field];
      return index < 0 ? null : cleanCell(record[index], maxLength);
    };
    rows.push({
      email,
      restaurantName: get("restaurantName", 255),
      city: get("city", 160),
      address: get("address", 2000),
      phone: get("phone", 50),
      website: get("website", 1000),
      foodSafetyNote: get("foodSafetyNote", 2000),
      legalRepresentative: get("legalRepresentative", 255),
      siret: get("siret", 32),
      source: get("source", 1000),
    });
  }

  return {
    rows,
    totalRows,
    invalidRows,
    duplicateRows,
    sample: rows.slice(0, 8),
  };
}
