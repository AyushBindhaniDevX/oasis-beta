import fs from 'fs';
import path from 'path';

const svgDir = path.resolve('assets/work-management-and-growth-illustrations-svg');
const outputFile = path.resolve('src/constants/workManagementSvgs.ts');

function inlineSvgStyles(rawSvg) {
  // Extract style tag content
  const styleMatch = rawSvg.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
  let svg = rawSvg.replace(/<style[\s\S]*?<\/style>/gi, '');

  if (styleMatch) {
    const css = styleMatch[1];
    // Match rules like .st0{fill:#FEBB08;stroke:#...}
    const ruleRegex = /\.([a-zA-Z0-9_-]+)\s*\{([^}]+)\}/g;
    let match;
    const classStyles = new Map();

    while ((match = ruleRegex.exec(css)) !== null) {
      const className = match[1];
      const declarations = match[2].trim();
      const declObj = {};
      declarations.split(';').forEach((d) => {
        const parts = d.split(':');
        if (parts.length === 2) {
          declObj[parts[0].trim()] = parts[1].trim();
        }
      });
      classStyles.set(className, declObj);
    }

    // Now replace class="stX" or class='stX' with the attributes
    for (const [cls, attrs] of classStyles.entries()) {
      const attrStr = Object.entries(attrs)
        .map(([k, v]) => `${k}="${v}"`)
        .join(' ');
      const classRegex = new RegExp(`class=["']${cls}["']`, 'g');
      svg = svg.replace(classRegex, attrStr);
    }
  }

  // Extract <svg ... </svg>
  const svgMatch = svg.match(/<svg[\s\S]*<\/svg>/i);
  if (!svgMatch) return null;
  let res = svgMatch[0];
  // Remove XML comments
  res = res.replace(/<!--[\s\S]*?-->/g, '');
  // Collapse whitespace
  res = res.replace(/\r?\n\s*/g, ' ').trim();
  return res;
}

// Map files to export constant names
const exportMapping = [
  // Original stock SVGs
  { file: 'stock-1-work-management-and-growth-illustrations.svg', varName: 'STOCK_1_SVG' },
  { file: 'stock-2-work-management-and-growth-illustrations.svg', varName: 'STOCK_2_SVG' },
  { file: 'stock-3-work-management-and-growth-illustrations.svg', varName: 'STOCK_3_SVG' },
  { file: 'stock-4-work-management-and-growth-illustrations.svg', varName: 'STOCK_4_SVG' },
  { file: 'stock-5-work-management-and-growth-illustrations.svg', varName: 'STOCK_5_SVG' },
  { file: 'stock-6-work-management-and-growth-illustrations.svg', varName: 'STOCK_6_SVG' },
  { file: 'stock-7-work-management-and-growth-illustrations.svg', varName: 'STOCK_7_SVG' },
  { file: 'stock-8-work-management-and-growth-illustrations.svg', varName: 'STOCK_8_SVG' },
  { file: 'stock-9-work-management-and-growth-illustrations.svg', varName: 'STOCK_9_SVG' },
  { file: 'stock-10-work-management-and-growth-illustrations.svg', varName: 'STOCK_10_SVG' },
  { file: 'stock-11-work-management-and-growth-illustrations.svg', varName: 'STOCK_11_SVG' },
  { file: 'stock-12-work-management-and-growth-illustrations.svg', varName: 'STOCK_12_SVG' },
  { file: 'stock-13-work-management-and-growth-illustrations.svg', varName: 'STOCK_13_SVG' },

  // Business Pack
  { file: 'business-analysis-free-business-illustrations-pack.svg', varName: 'BUSINESS_ANALYSIS_SVG' },
  { file: 'business-customer-support-free-business-illustrations-pack.svg', varName: 'BUSINESS_CUSTOMER_SUPPORT_SVG' },
  { file: 'business-data-free-business-illustrations-pack.svg', varName: 'BUSINESS_DATA_SVG' },
  { file: 'business-ideas-free-business-illustrations-pack.svg', varName: 'BUSINESS_IDEAS_SVG' },
  { file: 'business-payment-free-business-illustrations-pack.svg', varName: 'BUSINESS_PAYMENT_SVG' },
  { file: 'business-pitch-free-business-illustrations-pack.svg', varName: 'BUSINESS_PITCH_SVG' },
  { file: 'business-reviews-free-business-illustrations-pack.svg', varName: 'BUSINESS_REVIEWS_SVG' },

  // Productive Illustrations
  { file: 'productiveillustration-1-free-drawing-productive-illustrations.svg', varName: 'PRODUCTIVE_1_SVG' },
  { file: 'productiveillustration-2-free-drawing-productive-illustrations.svg', varName: 'PRODUCTIVE_2_SVG' },
  { file: 'productiveillustration-3-free-drawing-productive-illustrations.svg', varName: 'PRODUCTIVE_3_SVG' },
  { file: 'productiveillustration-4-free-drawing-productive-illustrations.svg', varName: 'PRODUCTIVE_4_SVG' },
  { file: 'productiveillustration-5-free-drawing-productive-illustrations.svg', varName: 'PRODUCTIVE_5_SVG' },
  { file: 'productiveillustration-6-free-drawing-productive-illustrations.svg', varName: 'PRODUCTIVE_6_SVG' },
  { file: 'productiveillustration-7-free-drawing-productive-illustrations.svg', varName: 'PRODUCTIVE_7_SVG' },
  { file: 'productiveillustration-8-free-drawing-productive-illustrations.svg', varName: 'PRODUCTIVE_8_SVG' },
  { file: 'productiveillustration-9-free-drawing-productive-illustrations.svg', varName: 'PRODUCTIVE_9_SVG' },
  { file: 'productiveillustration-10-free-drawing-productive-illustrations.svg', varName: 'PRODUCTIVE_10_SVG' },
];

let fileContent = `// Auto-generated clean inlined SVGs for work-management-and-growth-illustrations-svg
// Includes Stock 1-13, Business Pack (7), and Productive Illustrations (10)

`;

const catalogEntries = [];

for (const entry of exportMapping) {
  const filePath = path.join(svgDir, entry.file);
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${entry.file}`);
    continue;
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const cleaned = inlineSvgStyles(raw);

  if (!cleaned) {
    console.error(`Failed to clean SVG: ${entry.file}`);
    continue;
  }

  // Escape any backticks inside svg string if any
  const escaped = cleaned.replace(/`/g, '\\`').replace(/\${/g, '\\${');

  fileContent += `export const ${entry.varName} = \`${escaped}\`;\n\n`;
  catalogEntries.push({ varName: entry.varName, file: entry.file });
}

// Add unified catalog export
fileContent += `/**
 * Complete collection catalog of Work Management, Business, and Productivity Illustrations
 */
export const WORK_MANAGEMENT_SVGS = {
`;

for (const entry of catalogEntries) {
  fileContent += `  ${entry.varName}: ${entry.varName},\n`;
}

fileContent += `};\n`;

fs.writeFileSync(outputFile, fileContent, 'utf8');
console.log(`Successfully generated ${outputFile} with ${catalogEntries.length} illustration SVGs!`);

