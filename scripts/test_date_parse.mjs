import xlsx from 'xlsx';

function parseExcelDate(val) {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel serial number
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return date.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  if (!s) return null;
  // If already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // DD/MM/YYYY or DD.MM.YYYY
  const parts = s.split(/[\/\.\-]/);
  if (parts.length === 3) {
    let [d, m, y] = parts;
    if (y.length === 2) y = (parseInt(y, 10) > 30 ? '19' : '20') + y;
    if (d.length === 4) { // YYYY-MM-DD
      return `${d}-${m.padStart(2, '0')}-${y.padStart(2, '0')}`;
    }
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

console.log('43720 ->', parseExcelDate(43720));
console.log('27093 ->', parseExcelDate(27093));
console.log('"08/07/1964" ->', parseExcelDate("08/07/1964"));
console.log('"02.02.2012" ->', parseExcelDate("02.02.2012"));
console.log('"15/03/2024" ->', parseExcelDate("15/03/2024"));

