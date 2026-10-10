import { Platform, Alert } from 'react-native';
import * as XLSX from 'xlsx';

export async function exportExcel(
  filenameBase: string,
  sheets: { name: string; headers?: string[]; rows: any[][] }[]
): Promise<boolean> {
  const stamp = new Date().toISOString().slice(0, 10);
  const filename = `${filenameBase}_${stamp}.xlsx`;

  const wb = XLSX.utils.book_new();

  for (const sheet of sheets) {
    const data = sheet.headers ? [sheet.headers, ...sheet.rows] : sheet.rows;
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, sheet.name);
  }

  if (Platform.OS === 'web') {
    try {
      XLSX.writeFile(wb, filename);
      return true;
    } catch {
      return false;
    }
  }

  // Native: write base64 to cache and open the share sheet
  try {
    const FileSystem: any = require('expo-file-system');
    const Sharing: any = require('expo-sharing');
    let uri: string | null = null;
    
    // Get base64 string from xlsx
    const wbout = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });

    // Preferred: SDK 54+ File/Paths API
    if (FileSystem?.File && FileSystem?.Paths) {
      const file = new FileSystem.File(FileSystem.Paths.cache, filename);
      try {
        if (file.exists) file.delete();
      } catch {}
      file.create();
      file.write(wbout, { encoding: FileSystem.EncodingType?.Base64 || 'base64' });
      uri = file.uri;
    } else if (typeof FileSystem?.writeAsStringAsync === 'function') {
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      uri = dir + filename;
      await FileSystem.writeAsStringAsync(uri, wbout, {
        encoding: FileSystem?.EncodingType?.Base64 || 'base64',
      });
    }

    if (uri && Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, {
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        dialogTitle: filename,
        UTI: 'com.microsoft.excel.xls',
      });
      return true;
    }
    Alert.alert('Export ready', 'The file was created but sharing is not available on this device.');
    return false;
  } catch (err) {
    Alert.alert('Export unavailable', 'Excel export works best from the web dashboard on this device.');
    return false;
  }
}

/**
 * Export data as a downloadable / shareable Txt file (e.g. for ECR).
 */
export async function exportTxt(
  filenameBase: string,
  content: string
): Promise<boolean> {
  const filename = `${filenameBase}.txt`;

  if (Platform.OS === 'web') {
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }

  // Native
  try {
    const FileSystem: any = require('expo-file-system');
    const Sharing: any = require('expo-sharing');
    let uri: string | null = null;

    if (FileSystem?.File && FileSystem?.Paths) {
      const file = new FileSystem.File(FileSystem.Paths.cache, filename);
      try {
        if (file.exists) file.delete();
      } catch {}
      file.create();
      file.write(content);
      uri = file.uri;
    } else if (typeof FileSystem?.writeAsStringAsync === 'function') {
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || '';
      uri = dir + filename;
      await FileSystem.writeAsStringAsync(uri, content, {
        encoding: FileSystem?.EncodingType?.UTF8 || 'utf8',
      });
    }


    if (uri && Sharing && (await Sharing.isAvailableAsync())) {
      await Sharing.shareAsync(uri, {
        mimeType: 'text/plain',
        dialogTitle: filename,
        UTI: 'public.plain-text',
      });
      return true;
    }
    Alert.alert('Export ready', 'The file was created but sharing is not available on this device.');
    return false;
  } catch {
    Alert.alert('Export unavailable', 'Text export works best from the web dashboard on this device.');
    return false;
  }
}

/**
 * Prompt the user to pick an Excel or CSV file and return its parsed sheets as objects.
 * Web only (uses a hidden file input). On native, shows an informational Alert and resolves null.
 */
export function importExcelObjects(): Promise<Record<string, any[]> | null> {
  if (Platform.OS !== 'web') {
    Alert.alert('Import on web', 'Bulk data import is available from the web dashboard.');
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.xlsx, .xls, .csv, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      input.style.display = 'none';
      input.onchange = (e: any) => {
        const file = e.target.files && e.target.files[0];
        if (!file) {
          resolve(null);
          return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target?.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const sheets: Record<string, any[]> = {};
            for (const sheetName of workbook.SheetNames) {
              const ws = workbook.Sheets[sheetName];
              sheets[sheetName] = XLSX.utils.sheet_to_json(ws, { defval: '' });
            }
            resolve(sheets);
          } catch {
            resolve(null);
          }
        };
        reader.onerror = () => resolve(null);
        reader.readAsArrayBuffer(file);
      };
      document.body.appendChild(input);
      input.click();
      setTimeout(() => {
        try { document.body.removeChild(input); } catch {}
      }, 1000);
    } catch {
      resolve(null);
    }
  });
}

