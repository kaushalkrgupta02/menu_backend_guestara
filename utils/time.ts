export const formatTimestampToLocal = (dateInput?: string | Date | null): string | null => {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  const pad = (n: number) => n.toString().padStart(2, '0');
  const day = pad(d.getDate());
  const month = pad(d.getMonth() + 1);
  const year = d.getFullYear();
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  const seconds = pad(d.getSeconds());
  return `${day}-${month}-${year} ${hours}:${minutes}:${seconds}`;
};

export default formatTimestampToLocal;