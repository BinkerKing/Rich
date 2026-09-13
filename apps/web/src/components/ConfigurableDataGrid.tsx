import { useMemo, useState, type Key, type ReactNode } from "react";
import DataGrid, { SelectColumn, type Column, type RowsChangeData } from "react-data-grid";
import "react-data-grid/lib/styles.css";
import "./ConfigurableDataGrid.css";

export type ConfigurableGridRow = { id: string; [key: string]: unknown };
export type ConfigurableGridColumn = {
  key: string;
  name: string;
  width?: number;
  frozen?: boolean | "left" | "right";
  editable?: boolean;
  options?: Array<{ label: string; value: string }>;
};

type ConfigurableDataGridProps<Row extends ConfigurableGridRow> = {
  ariaLabel: string;
  rows: Row[];
  columns: ConfigurableGridColumn[];
  onRowsChange: (rows: Row[], data: RowsChangeData<Row>) => void;
  onColumnsChange: (columns: ConfigurableGridColumn[]) => void;
  onAddRow?: () => void;
  onRowClick?: (row: Row) => void;
  activeRowId?: string;
  onSelectedRowsChange?: (rows: ReadonlySet<Key>) => void;
  toolbar?: ReactNode;
  emptyRowsRenderer?: ReactNode;
  showSettings?: boolean;
  fillHeight?: boolean;
};

function columnKeyFromLabel(value: string) {
  return `custom_${value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "_").replace(/^_+|_+$/g, "") || "column"}`;
}

export function ConfigurableDataGrid<Row extends ConfigurableGridRow>({ ariaLabel, rows, columns, onRowsChange, onColumnsChange, onAddRow, onRowClick, activeRowId, onSelectedRowsChange, toolbar, emptyRowsRenderer, showSettings = true, fillHeight = false }: ConfigurableDataGridProps<Row>): ReactNode {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [selectedRows, setSelectedRows] = useState<ReadonlySet<Key>>(() => new Set());
  const gridColumns = useMemo(() => {
    const hasConfiguredRowNumber = columns.some(column => column.name.trim() === "序号");
    const rowNumberColumn = {
      key: "__rowNumber",
      name: "序号",
      width: 60,
      frozen: true,
      resizable: false,
      sortable: false,
      draggable: false,
      renderCell: ({ rowIdx }: { rowIdx: number }) => <span className="configurable-data-grid__row-number">{String(rowIdx + 1).padStart(2, "0")}</span>,
    } as Column<Row>;
    return [
      SelectColumn as Column<Row>,
      ...(hasConfiguredRowNumber ? [] : [rowNumberColumn]),
      ...columns.map((column): Column<Row> => {
        const isRowNumberColumn = column.name.trim() === "序号";
        return {
          key: column.key,
          name: column.name,
          width: column.width,
          frozen: Boolean(column.frozen),
          editable: !isRowNumberColumn && column.editable !== false,
          resizable: true,
          sortable: !isRowNumberColumn,
          draggable: true,
          renderCell: isRowNumberColumn ? ({ rowIdx }: { rowIdx: number }) => <span className="configurable-data-grid__row-number">{String(rowIdx + 1).padStart(2, "0")}</span> : undefined,
          renderEditCell: column.options ? ({ row, onRowChange }) => <select className="configurable-data-grid__select" autoFocus value={String(row[column.key] ?? "")} onChange={event => onRowChange({ ...row, [column.key]: event.target.value })}>{column.options?.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : undefined,
        };
      }),
    ];
  }, [columns]);

  const addColumn = () => {
    const name = newColumnName.trim();
    if (!name) return;
    let key = columnKeyFromLabel(name);
    let suffix = 2;
    while (columns.some(column => column.key === key)) key = `${columnKeyFromLabel(name)}_${suffix++}`;
    onColumnsChange([...columns, { key, name, width: 160 }]);
    setNewColumnName("");
  };

  const updateColumn = (key: string, patch: Partial<ConfigurableGridColumn>) => onColumnsChange(columns.map(column => column.key === key ? { ...column, ...patch } : column));

  const configuredColumnOffset = 1 + (columns.some(column => column.name.trim() === "序号") ? 0 : 1);
  return <section className={`configurable-data-grid${fillHeight ? " configurable-data-grid--fill" : ""}`} aria-label={ariaLabel}>
    <header className="configurable-data-grid__toolbar">
      <div>{toolbar}</div>
      <div className="configurable-data-grid__actions">
        {onAddRow && <button type="button" className="configurable-data-grid__primary" onClick={onAddRow}>＋ 新增记录</button>}
        {showSettings && <button type="button" className="configurable-data-grid__settings-trigger" aria-expanded={isSettingsOpen} onClick={() => setIsSettingsOpen(open => !open)}>表格设置</button>}
      </div>
    </header>
    {showSettings && isSettingsOpen && <aside className="configurable-data-grid__settings" aria-label="表格设置">
      <div className="configurable-data-grid__settings-heading"><div><b>列设置</b><span>拖动表头边缘可调整列宽</span></div><button type="button" aria-label="关闭表格设置" onClick={() => setIsSettingsOpen(false)}>×</button></div>
      <div className="configurable-data-grid__add-column"><input value={newColumnName} onChange={event => setNewColumnName(event.target.value)} onKeyDown={event => { if (event.key === "Enter") addColumn(); }} placeholder="例如：影响范围" /><button type="button" onClick={addColumn}>添加列</button></div>
      <div className="configurable-data-grid__column-list">{columns.map(column => <label key={column.key}><span><input aria-label={`${column.name}列名`} value={column.name} onChange={event => updateColumn(column.key, { name: event.target.value })} /><small>{column.key.startsWith("custom_") ? "自定义列" : "系统列"}</small></span><span><input type="checkbox" checked={Boolean(column.frozen)} onChange={event => updateColumn(column.key, { frozen: event.target.checked })} /> 冻结</span></label>)}</div>
    </aside>}
    <DataGrid<Row>
      className="configurable-data-grid__grid"
      columns={gridColumns}
      rows={rows}
      rowKeyGetter={row => row.id}
      selectedRows={selectedRows}
      onSelectedRowsChange={nextRows => { setSelectedRows(nextRows); onSelectedRowsChange?.(nextRows); }}
      rowClass={row => row.id === activeRowId ? "configurable-data-grid__row--active" : undefined}
      onRowsChange={onRowsChange}
      onCellClick={onRowClick ? ({ row, column }) => { if (column.key !== "select-row") onRowClick(row); } : undefined}
      onColumnResize={(index, width) => { const column = columns[index - configuredColumnOffset]; if (column) updateColumn(column.key, { width }); }}
      onColumnsReorder={(sourceKey, targetKey) => { const sourceIndex = columns.findIndex(column => column.key === sourceKey); const targetIndex = columns.findIndex(column => column.key === targetKey); if (sourceIndex < 0 || targetIndex < 0) return; const next = [...columns]; const [source] = next.splice(sourceIndex, 1); next.splice(targetIndex, 0, source); onColumnsChange(next); }}
    />
    {!rows.length && emptyRowsRenderer && <div className="configurable-data-grid__empty">{emptyRowsRenderer}</div>}
  </section>;
}
