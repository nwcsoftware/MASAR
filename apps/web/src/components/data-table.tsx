import { useState, type ReactNode } from 'react';
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
  type VisibilityState,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, Columns3, Download } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { downloadCsv } from '@/lib/csv';
import { cn } from '@/lib/utils';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    /** translated header for the column menu and CSV */
    label?: string;
    /** plain value for CSV export */
    csv?: (row: TData) => string | number | null | undefined;
    className?: string;
  }
}

/**
 * docs/DESIGN.md §5 DataTable — TanStack Table, sticky header, column
 * visibility, CSV export of the visible columns.
 */
export function DataTable<TData>({
  columns,
  data,
  loading,
  empty,
  onRowClick,
  csvFilename,
  toolbar,
  getRowId,
}: {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  loading?: boolean;
  empty?: ReactNode;
  onRowClick?: (row: TData) => void;
  csvFilename?: string;
  toolbar?: ReactNode;
  getRowId?: (row: TData) => string;
}) {
  const { t } = useTranslation();
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});

  const table = useReactTable({
    data,
    columns,
    state: { sorting, columnVisibility },
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId,
  });

  const exportCsv = () => {
    const visible = table.getVisibleLeafColumns().filter((c) => c.columnDef.meta?.csv);
    downloadCsv(csvFilename ?? 'export.csv', [
      visible.map((c) => c.columnDef.meta?.label ?? c.id),
      ...table.getRowModel().rows.map((row) => visible.map((c) => c.columnDef.meta?.csv?.(row.original))),
    ]);
  };

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
        <div className="flex flex-1 flex-wrap items-center gap-2">{toolbar}</div>
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <Columns3 aria-hidden="true" />
                {t('table.columns')}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>{t('table.columns')}</DropdownMenuLabel>
              {table
                .getAllLeafColumns()
                .filter((c) => c.getCanHide())
                .map((column) => (
                  <DropdownMenuItem
                    key={column.id}
                    onSelect={(event) => {
                      event.preventDefault();
                      column.toggleVisibility();
                    }}
                  >
                    <span
                      className={cn('grid size-4 place-items-center rounded-sm border border-border-strong', column.getIsVisible() && 'border-brand-500 bg-brand-500')}
                      aria-hidden="true"
                    />
                    {column.columnDef.meta?.label ?? column.id}
                  </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {csvFilename && (
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!data.length}>
              <Download aria-hidden="true" />
              {t('table.exportCsv')}
            </Button>
          )}
        </div>
      </div>

      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((group) => (
            <TableRow key={group.id} className="hover:bg-transparent">
              {group.headers.map((header) => {
                const sorted = header.column.getIsSorted();
                return (
                  <TableHead key={header.id} className={header.column.columnDef.meta?.className}>
                    {header.isPlaceholder ? null : header.column.getCanSort() ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 uppercase hover:text-fg"
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {sorted === 'asc' && <ArrowUp className="size-3" aria-hidden="true" />}
                        {sorted === 'desc' && <ArrowDown className="size-3" aria-hidden="true" />}
                      </button>
                    ) : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                  </TableHead>
                );
              })}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {loading
            ? Array.from({ length: 6 }, (_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  {table.getVisibleLeafColumns().map((c) => (
                    <TableCell key={c.id}>
                      <Skeleton className="h-4 w-full max-w-32" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            : table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className={cn(onRowClick && 'cursor-pointer')}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  onKeyDown={
                    onRowClick
                      ? (event) => {
                          if (event.key === 'Enter') onRowClick(row.original);
                        }
                      : undefined
                  }
                  tabIndex={onRowClick ? 0 : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={cell.column.columnDef.meta?.className}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
        </TableBody>
      </Table>
      {!loading && !data.length && empty}
    </div>
  );
}
