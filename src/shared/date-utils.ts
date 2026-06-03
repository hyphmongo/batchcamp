const MONTHS: Record<string, string> = {
  Jan: "01",
  Feb: "02",
  Mar: "03",
  Apr: "04",
  May: "05",
  Jun: "06",
  Jul: "07",
  Aug: "08",
  Sep: "09",
  Oct: "10",
  Nov: "11",
  Dec: "12",
};

const BANDCAMP_DATE = /^(\d{1,2})\s(\w{3})\s(\d{4})/;

const parseBandcampDate = (
  dateStr: string,
): { year: string; month: string; day: string } | null => {
  const match = dateStr.match(BANDCAMP_DATE);
  if (!match) {
    return null;
  }

  const day = match[1]!;
  const monthStr = match[2]!;
  const year = match[3]!;
  const month = MONTHS[monthStr];
  if (!month) {
    return null;
  }

  const dayNum = Number.parseInt(day, 10);
  if (dayNum < 1 || dayNum > 31) {
    return null;
  }

  return { year, month, day: day.padStart(2, "0") };
};

export const parseYear = (dateStr?: string): string => {
  if (!dateStr) {
    return "";
  }
  return parseBandcampDate(dateStr)?.year ?? "";
};

export const parseDate = (dateStr?: string): string => {
  if (!dateStr) {
    return "";
  }
  const parts = parseBandcampDate(dateStr);
  if (!parts) {
    return "";
  }
  return `${parts.year}-${parts.month}-${parts.day}`;
};
