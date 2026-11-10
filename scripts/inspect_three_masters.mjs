import xlsx from 'xlsx';

const files = {
  shanti: 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832520_04b3108b.xlsx',
  gopal: 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832523_b67ad4a8.xlsx',
  chikitsa: 'C:/Users/HP/.gemini/antigravity/brain/7f2ae8c6-bd83-4a4b-a046-dd3de2afa988/.user_uploaded/media_1794290832524_c86969ab.xlsx'
};

for (const [key, path] of Object.entries(files)) {
  const wb = xlsx.readFile(path);
  console.log(`\n================== ${key.toUpperCase()} ==================`);
  console.log('Sheets:', wb.SheetNames);
  for (const sheetName of wb.SheetNames) {
    const ws = wb.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(ws, { header: 1 });
    console.log(`  Sheet [${sheetName}]: ${data.length} rows`);
    if (data.length > 0) {
      console.log('    First 3 rows preview:');
      for (let i = 0; i < Math.min(3, data.length); i++) {
        console.log(`      Row ${i}:`, JSON.stringify(data[i]?.slice(0, 15)));
      }
    }
  }
}

