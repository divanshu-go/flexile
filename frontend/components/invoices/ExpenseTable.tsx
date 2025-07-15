import { PaperClipIcon, PlusIcon, TrashIcon } from "@heroicons/react/24/outline";
import React from "react";
import ComboBox from "@/components/ComboBox";
import NumberInput from "@/components/NumberInput";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { InvoiceFormExpense } from "@/types/invoice";

type ExpenseCategory = { id: number; name: string };
type ExpenseTableData = {
  company: {
    expenses: {
      categories: ExpenseCategory[];
    };
  };
};

type ExpenseTableProps = {
  expenses: InvoiceFormExpense[];
  updateExpense: (index: number, update: Partial<InvoiceFormExpense>) => void;
  removeExpense: (index: number) => void;
  data: ExpenseTableData;
  showExpensesTable: boolean;
  onAddExpense: () => void;
};

const ExpenseTable = ({
  expenses,
  updateExpense,
  removeExpense,
  data,
  showExpensesTable,
  onAddExpense,
}: ExpenseTableProps) => {
  if (!showExpensesTable) return null;
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Expense</TableHead>
          <TableHead>Merchant</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead />
        </TableRow>
      </TableHeader>
      <TableBody>
        {expenses.map((expense, rowIndex) => (
          <TableRow key={rowIndex}>
            <TableCell>
              <a href={expense.attachment.url} download>
                <PaperClipIcon className="inline size-4" />
                {expense.attachment.name}
              </a>
            </TableCell>
            <TableCell>
              <Input
                value={expense.description}
                aria-label="Merchant"
                aria-invalid={expense.errors?.includes("description")}
                onChange={(e) => updateExpense(rowIndex, { description: e.target.value })}
              />
            </TableCell>
            <TableCell>
              <ComboBox
                value={expense.category_id.toString()}
                options={data.company.expenses.categories.map((category) => ({
                  value: category.id.toString(),
                  label: category.name,
                }))}
                aria-label="Category"
                aria-invalid={expense.errors?.includes("category")}
                onChange={(value: string) => updateExpense(rowIndex, { category_id: Number(value) })}
              />
            </TableCell>
            <TableCell className="text-right tabular-nums">
              <NumberInput
                value={expense.total_amount_in_cents / 100}
                placeholder="0"
                onChange={(value: number | null) =>
                  updateExpense(rowIndex, { total_amount_in_cents: (value ?? 0) * 100 })
                }
                aria-label="Amount"
                aria-invalid={expense.errors?.includes("amount") ?? false}
                prefix="$"
                decimal
              />
            </TableCell>
            <TableCell>
              <Button variant="link" aria-label="Remove expense" onClick={() => removeExpense(rowIndex)}>
                <TrashIcon className="size-4" />
              </Button>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell colSpan={5}>
            <Button variant="link" aria-label="Add expense" onClick={onAddExpense}>
              <PlusIcon className="inline size-4" />
              Add expense
            </Button>
          </TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
};

export default ExpenseTable;
