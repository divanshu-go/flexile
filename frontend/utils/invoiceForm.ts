import { List } from "immutable";
import type { InvoiceFormExpense, InvoiceFormLineItem } from "@/types/invoice";
import { assertDefined } from "@/utils/assert";

export const DEFAULT_QUANTITY = 60;
export const DEFAULT_PROJECT_QUANTITY = 1;
export const DEFAULT_PAY_RATE = 0;

export const lineItemTotal = (lineItem: InvoiceFormLineItem): number =>
  Math.ceil(((lineItem.quantity ?? 0) / (lineItem.hourly ? DEFAULT_QUANTITY : 1)) * lineItem.pay_rate_in_subunits);

export const updateLineItem = (
  lineItems: List<InvoiceFormLineItem>,
  index: number,
  update: Partial<InvoiceFormLineItem>,
): List<InvoiceFormLineItem> =>
  lineItems.update(index, (lineItem) => {
    const updated: InvoiceFormLineItem = { ...assertDefined(lineItem), ...update };
    updated.errors = [];
    if (updated.description.length === 0) updated.errors.push("description");
    if (!updated.quantity || updated.quantity <= 0) updated.errors.push("quantity");
    return updated;
  });

export const updateExpense = (
  expenses: List<InvoiceFormExpense>,
  index: number,
  update: Partial<InvoiceFormExpense>,
): List<InvoiceFormExpense> =>
  expenses.update(index, (expense) => {
    const updated: InvoiceFormExpense = { ...assertDefined(expense), ...update };
    updated.errors = [];
    if (updated.description.length === 0) updated.errors.push("description");
    if (!updated.category_id) updated.errors.push("category");
    if (!updated.total_amount_in_cents) updated.errors.push("amount");
    return updated;
  });
