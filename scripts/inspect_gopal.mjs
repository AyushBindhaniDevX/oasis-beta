import xlsx from 'xlsx';

const path = 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832523_b67ad4a8.xlsx';
const wb = xlsx.readFile(path);

for (const sheet of wb.SheetNames) {
  const ws = wb.Sheets[sheet];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1 });
  console.log(`Sheet: ${sheet}, raw rows: ${rows.length}`);
  let validRows = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (row && row.some(cell => cell !== null && cell !== undefined && String(cell).trim() !== '')) {
      if (i < 30 || i > rows.length - 10) {
        // console.log(`Row ${i}:`, row.slice(0, 6));
      }
      validRows++;
    }
  }
  console.log(`Valid non-empty rows: ${validRows}`);
}

