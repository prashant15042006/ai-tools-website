/* Professional Table Styles */
export const tableStyles = `
  .professional-table-wrapper {
    overflow-x: auto;
    margin: 28px 0;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .professional-table-wrapper table {
    width: 100%;
    border-collapse: collapse;
    background: linear-gradient(135deg, #0f172a 0%, #1a1a2e 100%);
    font-family: 'Segoe UI', 'Roboto', -apple-system, sans-serif;
    letter-spacing: 0.3px;
  }

  .professional-table-wrapper thead {
    background: linear-gradient(135deg, #1e293b 0%, #1e1b4b 100%);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .professional-table-wrapper thead th {
    padding: 18px 24px;
    text-align: left;
    font-weight: 700;
    font-size: 13px;
    color: #e0e7ff;
    text-transform: uppercase;
    letter-spacing: 1px;
    border-bottom: 2px solid rgba(99, 102, 241, 0.4);
    background: linear-gradient(135deg, #1e293b 0%, #1e1b4b 100%);
  }

  .professional-table-wrapper tbody tr {
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border-bottom: 1px solid rgba(99, 102, 241, 0.12);
  }

  .professional-table-wrapper tbody tr:hover {
    background-color: rgba(99, 102, 241, 0.15);
    transform: translateX(4px);
    box-shadow: inset 3px 0 0 0 rgba(99, 102, 241, 0.6);
  }

  .professional-table-wrapper tbody tr:last-child {
    border-bottom: none;
  }

  .professional-table-wrapper td {
    padding: 16px 24px;
    font-size: 14px;
    color: #cbd5e1;
    font-weight: 500;
    line-height: 1.6;
    transition: color 0.3s ease;
  }

  .professional-table-wrapper tbody tr:hover td {
    color: #f1f5f9;
  }

  .professional-table-wrapper td:first-child {
    font-weight: 700;
    color: #a5f3fc;
    background: rgba(165, 243, 252, 0.05);
    border-left: 3px solid rgba(99, 102, 241, 0.5);
  }

  .professional-table-wrapper tbody tr:hover td:first-child {
    color: #06b6d4;
    background: rgba(6, 182, 212, 0.1);
  }

  @media (max-width: 768px) {
    .professional-table-wrapper {
      margin: 16px -8px;
      border-radius: 8px;
    }

    .professional-table-wrapper thead th {
      padding: 14px 16px;
      font-size: 12px;
    }

    .professional-table-wrapper td {
      padding: 12px 16px;
      font-size: 13px;
    }
  }
`;

// Utility to inject table styles
export const injectTableStyles = () => {
  if (typeof document !== 'undefined') {
    const styleId = 'professional-table-styles';
    if (!document.getElementById(styleId)) {
      const styleSheet = document.createElement('style');
      styleSheet.id = styleId;
      styleSheet.textContent = tableStyles;
      document.head.appendChild(styleSheet);
    }
  }
};

// Utility to convert data into markdown table format
export const convertToMarkdownTable = (data, headers) => {
  if (!Array.isArray(data) || data.length === 0) return '';

  const cols = headers || (typeof data[0] === 'object' ? Object.keys(data[0]) : []);
  
  if (cols.length === 0) return '';

  let markdown = '| ' + cols.join(' | ') + ' |\n';
  markdown += '|' + cols.map(() => ' --- ').join('|') + '|\n';

  for (const row of data) {
    if (typeof row === 'object') {
      const values = cols.map(col => {
        const val = row[col];
        return typeof val === 'string' ? val : JSON.stringify(val || '');
      });
      markdown += '| ' + values.join(' | ') + ' |\n';
    }
  }

  return markdown;
};

// Enhanced prompt helper for table generation
export const enhanceTablePrompt = (userMessage) => {
  const lowerMsg = userMessage.toLowerCase();
  const isTableRequest = /table|तालिका|tabular|format|list|सूची|दैनिक|daily|schedule|routine/i.test(userMessage);
  
  if (isTableRequest) {
    return userMessage + '\n\n📋 **Please format your response as a markdown table for clarity.** Use proper markdown syntax with pipes (|) for columns and dashes for separators.';
  }
  
  return userMessage;
};

// Parse AI response and convert to table if needed
export const parseAndFormatResponse = (response) => {
  if (response.includes('|')) {
    return response;
  }

  const lines = response.split('\n');
  const dataLines = lines.filter(line => line.trim() && !line.startsWith('#'));

  if (/^\d+\.|^-|^•/.test(dataLines[0])) {
    return convertListToTable(response);
  }

  return response;
};

// Convert numbered/bulleted list to markdown table
const convertListToTable = (text) => {
  const lines = text.split('\n').filter(line => line.trim());
  const items = [];

  for (const line of lines) {
    const cleaned = line.replace(/^[\d+\.\-•\s*]+/, '').trim();
    if (cleaned) {
      items.push(cleaned);
    }
  }

  if (items.length === 0) return text;

  const parsed = items.map(item => {
    const parts = item.split(/:|–|-/);
    return {
      time: parts[0]?.trim() || '',
      activity: parts.slice(1).join(':').trim() || parts[0]?.trim()
    };
  }).filter(p => p.time || p.activity);

  if (parsed.length > 0 && parsed[0].time) {
    return convertToMarkdownTable(parsed, ['Time', 'Activity']);
  }

  return text;
};

export default {
  convertToMarkdownTable,
  enhanceTablePrompt,
  parseAndFormatResponse,
  injectTableStyles,
  tableStyles
};
