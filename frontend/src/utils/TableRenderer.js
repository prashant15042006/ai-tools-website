import React from 'react';

const TableRenderer = ({ node, children }) => {
  return (
    <div className="professional-table-wrapper">
      <table>
        {children}
      </table>
    </div>
  );
};

const TableHeadRenderer = ({ children }) => (
  <thead>
    {children}
  </thead>
);

const TableBodyRenderer = ({ children }) => (
  <tbody>{children}</tbody>
);

const TableRowRenderer = ({ children, isHeader = false }) => (
  <tr>
    {children}
  </tr>
);

const TableCellRenderer = ({ children, isHeader = false }) => {
  if (isHeader) {
    return <th>{children}</th>;
  }
  return <td>{children}</td>;
};

export const tableComponents = {
  table: TableRenderer,
  thead: TableHeadRenderer,
  tbody: TableBodyRenderer,
  tr: TableRowRenderer,
  td: TableCellRenderer,
  th: (props) => <TableCellRenderer {...props} isHeader={true} />,
};

export default TableRenderer;
