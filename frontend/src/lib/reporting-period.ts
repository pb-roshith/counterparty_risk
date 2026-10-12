/** Previous completed calendar quarter, using the application's India timezone. */
export function previousQuarterLabel(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "numeric",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const currentQuarter = Math.ceil(month / 3);
  return currentQuarter === 1 ? `Q4 ${year - 1}` : `Q${currentQuarter - 1} ${year}`;
}
