import type { TableData } from "@/components/charts/chart-table";
import styles from "./DataTable.module.css";

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
