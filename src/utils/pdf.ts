/**
 * Cross-Platform PDF & Print Service
 * Supports Web (direct print/iframe fallback) and Native (iOS / Android)
 * Fixes: TypeError: Cannot destructure property 'uri' of '(intermediate value)' as it is undefined
 */

import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

export function printHtmlOnWeb(htmlContent: string, docTitle?: string): boolean {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  // Inject print CSS optimizations if not already present
  let enhancedHtml = htmlContent;
  if (!enhancedHtml.includes('print-color-adjust')) {
    const printStyle = `
      <style>
        @media print {
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            margin: 8mm;
          }
        }
      </style>
    `;
    if (enhancedHtml.includes('</head>')) {
      enhancedHtml = enhancedHtml.replace('</head>', `${printStyle}</head>`);
    } else {
      enhancedHtml = `${printStyle}${enhancedHtml}`;
    }
  }

  // 1. Try opening a clean print window
  try {
    const printWindow = window.open('', '_blank', 'width=1000,height=800');
    if (printWindow) {
      if (docTitle) {
        printWindow.document.title = docTitle;
      }
      printWindow.document.open();
      printWindow.document.write(enhancedHtml);
      printWindow.document.close();
      printWindow.focus();

      setTimeout(() => {
        try {
          printWindow.print();
        } catch (e) {
          console.error('Error invoking printWindow.print():', e);
        }
      }, 350);
      return true;
    }
  } catch (err) {
    console.warn('window.open was blocked, attempting iframe fallback:', err);
  }

  // 2. Fallback to hidden iframe (bypasses browser popup blockers reliably)
  try {
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.style.visibility = 'hidden';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(enhancedHtml);
      doc.close();

      setTimeout(() => {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error('Iframe print error:', err);
        } finally {
          setTimeout(() => {
            if (document.body.contains(iframe)) {
              document.body.removeChild(iframe);
            }
          }, 2000);
        }
      }, 350);
      return true;
    }
  } catch (iframeErr) {
    console.error('Iframe print fallback failed:', iframeErr);
  }

  return false;
}

export async function exportOrPrintPdf(
  htmlContent: string,
  fileName: string = 'Document.pdf'
): Promise<string | null> {
  if (Platform.OS === 'web') {
    const ok = printHtmlOnWeb(htmlContent, fileName);
    return ok ? 'printed' : null;
  }

  try {
    const result = await Print.printToFileAsync({ html: htmlContent });
    if (!result || !result.uri) {
      throw new Error('PDF generation returned an empty result');
    }

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(result.uri, {
        UTI: '.pdf',
        mimeType: 'application/pdf',
        dialogTitle: fileName,
      });
    }

    return result.uri;
  } catch (err) {
    console.error('Failed to export or share PDF:', err);
    throw err;
  }
}
