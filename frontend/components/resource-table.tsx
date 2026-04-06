type ResourceTableProps = {
  title: string;
  subtitle: string;
  columns: string[];
  rows: React.ReactNode;
};

export function ResourceTable({ title, subtitle, columns, rows }: ResourceTableProps) {
  return (
    <section className="table-panel">
      <div className="table-head">
        <div>
          <h3 className="section-title">{title}</h3>
          <p className="muted">{subtitle}</p>
        </div>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows}</tbody>
      </table>
    </section>
  );
}

