/**
 * Table Extension Configuration - Phase 5
 * Advanced table features with row/column operations and cell merging
 */

import * as TableExtensionModule from '@tiptap/extension-table'

const { Table, TableCell, TableHeader, TableRow } = TableExtensionModule as any

export const TableExtensions = [
  Table.configure({
    resizable: true,
    HTMLAttributes: {
      class: 'editor-table',
    },
  }),
  TableRow.configure({
    HTMLAttributes: {
      class: 'editor-table-row',
    },
  }),
  TableHeader.configure({
    HTMLAttributes: {
      class: 'editor-table-header',
    },
  }),
  TableCell.configure({
    HTMLAttributes: {
      class: 'editor-table-cell',
    },
  }),
]

export interface TableCommands {
  insertTable: (rows: number, cols: number) => void
  deleteTable: () => void
  addColumnBefore: () => void
  addColumnAfter: () => void
  deleteColumn: () => void
  addRowBefore: () => void
  addRowAfter: () => void
  deleteRow: () => void
  mergeCells: () => void
  splitCell: () => void
  toggleHeaderRow: () => void
  toggleHeaderColumn: () => void
  toggleHeaderCell: () => void
}
