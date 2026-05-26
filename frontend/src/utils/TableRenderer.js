import React from 'react';

const TableRenderer = ({ node, children }) => {
  // Get all rows from the table
  const rows = node.children.filter(n => n.type === 'tbody' || n.type === 'thead')[0]?.children || [];
  
  if (!rows.length) {
    return <table>{children}</table>;
  }

  return (
    <div style={{ overflowX: 'auto', margin: '16px 0' }}>
      <table style={{
        width: '100%',
        borderCollapse: 'collapse',
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
        {children}
      </table>
    </div>
  );
};

const TableHeadRenderer = ({ children }) => (
  <thead style={{ backgroundColor: 'var(--bg-tertiary)' }}>
    {children}
  </thead>
);

const TableBodyRenderer = ({ children }) => (
  <tbody>{children}</tbody>
);

const TableRowRenderer = ({ children, isHeader = false }) => (
  <tr style={{
    borderBottom: '1px solid var(--border-color)',
    ':hover': { backgroundColor: 'var(--bg-hover)' }
  }}>
    {children}
  </tr>
);

const TableCellRenderer = ({ children, isHeader = false }) => (
  <td style={{
    padding: '12px 16px',
    textAlign: isHeader ? 'left' : 'left',
    fontWeight: isHeader ? '600' : '400',
    color: 'var(--text-primary)',
    borderRight: '1px solid var(--border-color)',
    ':last-child': { borderRight: 'none' }
  }}>
    {children}
  </td>
);

export const tableComponents = {
  table: TableRenderer,
  thead: TableHeadRenderer,
  tbody: TableBodyRenderer,
  tr: TableRowRenderer,
  td: TableCellRenderer,
  th: (props) => <TableCellRenderer {...props} isHeader={true} />,
};

export default TableRenderer;
