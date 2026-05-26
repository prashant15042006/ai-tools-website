// Utility to convert data into markdown table format
export const convertToMarkdownTable = (data, headers) => {
  if (!Array.isArray(data) || data.length === 0) return '';

  // If no headers provided, try to extract from first object
  const cols = headers || (typeof data[0] === 'object' ? Object.keys(data[0]) : []);
  
  if (cols.length === 0) return '';

  // Create header row
  let markdown = '| ' + cols.join(' | ') + ' |\n';
  
  // Create separator row
  markdown += '|' + cols.map(() => ' --- ').join('|') + '|\n';

  // Create data rows
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
  
  // Check if user is asking for table format
  const isTableRequest = /table|तालिका|tabular|format|list|सूची|दैनिक|daily/i.test(userMessage);
  
  if (isTableRequest) {
    return userMessage + '\n\n📋 **Please format your response as a markdown table for clarity.** Use proper markdown syntax with pipes (|) for columns and dashes for separators.';
  }
  
  return userMessage;
};

// Parse AI response and convert to table if needed
export const parseAndFormatResponse = (response) => {
  // Check if response already contains table
  if (response.includes('|')) {
    return response; // Already in table format
  }

  // Try to detect structured data that could be a table
  const lines = response.split('\n');
  const dataLines = lines.filter(line => line.trim() && !line.startsWith('#'));

  // If we have numbered lists, convert to table
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
    // Remove numbering, bullets, or dashes
    const cleaned = line.replace(/^[\d+\.\-•\s*]+/, '').trim();
    if (cleaned) {
      items.push(cleaned);
    }
  }

  if (items.length === 0) return text;

  // Try to parse key-value pairs
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
  parseAndFormatResponse
};
