import styles from "./DataTable.module.css";

export interface TableColumn {
  readonly key: string;
  readonly label: string;
  readonly numeric: boolean;
}

/** What the table shows: a caption, columns and pre-formatted rows. Any feature can fill it. */
export interface TableData {
  readonly caption: string;
  readonly columns: readonly TableColumn[];
  /** Pre-formatted cells; null means no value. */
  readonly rows: readonly { readonly key: string; readonly cells: readonly (string | null)[] }[];
  /** Explains a cap on the rows shown, when there is one. */
  readonly note?: string;
}

/** An accessible data table in its own scrolling region (keyboard-scrollable, sticky header). */
export function DataTable({ data, maxHeight }: { data: TableData; maxHeight: number }) {
  return (
    <div className={styles.wrap}>
      <div
        className={styles.scroll}
        style={{ maxHeight }}
        // A focusable, named region so keyboard users can scroll it.
        tabIndex={0}
        role="region"
        aria-label={`${data.caption} table`}
      >
        <table className={styles.table}>
          <caption className="visually-hidden">{data.caption}</caption>
          <thead>
            <tr>
              {data.columns.map((c) => (
                <th key={c.key} scope="col" data-numeric={c.numeric || undefined}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row) => (
              <tr key={row.key}>
                {row.cells.map((cell, i) =>
                  i === 0 ? (
                    <th key={i} scope="row">
                      {cell}
                    </th>
                  ) : (
                    <td key={i} data-numeric>
                      {cell ?? (
                        <>
                          <span aria-hidden="true">–</span>
                          <span className="visually-hidden">No data</span>
                        </>
                      )}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.note && <p className={styles.note}>{data.note}</p>}
    </div>
  );
}
