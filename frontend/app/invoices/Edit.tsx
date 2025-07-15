"use client";

import { ArrowUpTrayIcon, PlusIcon } from "@heroicons/react/16/solid";
import { PaperAirplaneIcon, TrashIcon } from "@heroicons/react/24/outline";
import { type DateValue, parseDate } from "@internationalized/date";
import { useMutation, useSuspenseQuery } from "@tanstack/react-query";
import { List } from "immutable";
import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { redirect, useParams, useRouter, useSearchParams } from "next/navigation";
import React, { useEffect, useId, useRef, useState } from "react";
import DatePicker from "@/components/DatePicker";
import ExpenseTable from "@/components/invoices/ExpenseTable";
import MainLayout from "@/components/layouts/Main";
import NumberInput from "@/components/NumberInput";
import RangeInput from "@/components/RangeInput";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useCurrentCompany } from "@/global";
import { MAX_EQUITY_PERCENTAGE } from "@/models";
import { dataSchema } from "@/schemas/invoice";
import { trpc } from "@/trpc/client";
import { type InvoiceFormExpense, type InvoiceFormLineItem } from "@/types/invoice";
import { assertDefined } from "@/utils/assert";
import { formatMoneyFromCents } from "@/utils/formatMoney";
import {
  DEFAULT_PAY_RATE,
  DEFAULT_PROJECT_QUANTITY,
  DEFAULT_QUANTITY,
  lineItemTotal,
  updateExpense as updateExpenseHelper,
  updateLineItem as updateLineItemHelper,
} from "@/utils/invoiceForm";
import { request } from "@/utils/request";
import {
  company_invoice_path,
  company_invoices_path,
  edit_company_invoice_path,
  new_company_invoice_path,
} from "@/utils/routes";
import QuantityInput from "./QuantityInput";
import { LegacyAddress as Address, useCanSubmitInvoices } from ".";

const Edit = () => {
  const company = useCurrentCompany();
  const { canSubmitInvoices } = useCanSubmitInvoices();
  const uid = useId();
  if (!canSubmitInvoices) throw redirect("/invoices");
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const [errorField, setErrorField] = useState<string | null>(null);
  const router = useRouter();
  const trpcUtils = trpc.useUtils();

  const { data } = useSuspenseQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const response = await request({
        url: id ? edit_company_invoice_path(company.id, id) : new_company_invoice_path(company.id),
        method: "GET",
        accept: "json",
        assertOk: true,
      });
      return dataSchema.parse(await response.json());
    },
  });
  const payRateInSubunits = data.user.pay_rate_in_subunits;

  const [invoiceNumber, setInvoiceNumber] = useState(data.invoice.invoice_number);
  const [issueDate, setIssueDate] = useState<DateValue>(() =>
    parseDate(searchParams.get("date") || data.invoice.invoice_date),
  );
  const invoiceYear = issueDate.year;
  const [notes, setNotes] = useState(data.invoice.notes ?? "");
  const [lineItems, setLineItems] = useState<List<InvoiceFormLineItem>>(() => {
    if (data.invoice.line_items.length) return List<InvoiceFormLineItem>(data.invoice.line_items);

    return List<InvoiceFormLineItem>([
      {
        description: "",
        quantity: parseInt(searchParams.get("quantity") ?? "", 10) || (data.user.project_based ? 1 : 60),
        hourly: searchParams.has("hourly") ? searchParams.get("hourly") === "true" : !data.user.project_based,
        pay_rate_in_subunits: parseInt(searchParams.get("rate") ?? "", 10) || (payRateInSubunits ?? 0),
        errors: undefined,
        id: undefined,
      },
    ]);
  });
  const [showExpenses, setShowExpenses] = useState(false);
  const uploadExpenseRef = useRef<HTMLInputElement>(null);
  const [expenses, setExpenses] = useState<List<InvoiceFormExpense>>(List<InvoiceFormExpense>(data.invoice.expenses));
  const showExpensesTable = showExpenses || expenses.size > 0;

  const [equityAllocation, { refetch: refetchEquityAllocation }] = trpc.equityAllocations.get.useSuspenseQuery({
    companyId: company.id,
    year: invoiceYear,
  });
  const [equityPercentage, setEquityPercent] = useState(
    parseInt(searchParams.get("split") ?? "", 10) || equityAllocation?.equityPercentage || 0,
  );

  const equityPercentageMutation = trpc.equityAllocations.update.useMutation();
  const validate = () => {
    setErrorField(null);
    if (invoiceNumber.length === 0) setErrorField("invoiceNumber");
    return (
      errorField === null &&
      lineItems.every((lineItem) => !lineItem.errors?.length) &&
      expenses.every((expense) => !expense.errors?.length)
    );
  };

  const submit = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append("invoice[invoice_number]", invoiceNumber);
      formData.append("invoice[invoice_date]", issueDate.toString());
      for (const lineItem of lineItems) {
        if (!lineItem.description || !lineItem.quantity) continue;
        if (lineItem.id) {
          formData.append("invoice_line_items[][id]", lineItem.id.toString());
        }
        formData.append("invoice_line_items[][description]", lineItem.description);
        formData.append("invoice_line_items[][quantity]", lineItem.quantity.toString());
        formData.append("invoice_line_items[][hourly]", lineItem.hourly.toString());
        formData.append("invoice_line_items[][pay_rate_in_subunits]", lineItem.pay_rate_in_subunits.toString());
      }
      for (const expense of expenses) {
        if (expense.id) {
          formData.append("invoice_expenses[][id]", expense.id.toString());
        }
        formData.append("invoice_expenses[][description]", expense.description);
        formData.append("invoice_expenses[][expense_category_id]", expense.category_id.toString());
        formData.append("invoice_expenses[][total_amount_in_cents]", expense.total_amount_in_cents.toString());
        if (expense.blob) {
          formData.append("invoice_expenses[][attachment]", expense.blob);
        }
      }
      if (notes.length) formData.append("invoice[notes]", notes);

      if (equityPercentage !== data.equity_allocation?.percentage) {
        await equityPercentageMutation.mutateAsync({ companyId: company.id, equityPercentage, year: invoiceYear });
      }
      await request({
        method: id ? "PATCH" : "POST",
        url: id ? company_invoice_path(company.id, id) : company_invoices_path(company.id),
        accept: "json",
        formData,
        assertOk: true,
      });
      await trpcUtils.invoices.list.invalidate({ companyId: company.id });
      await trpcUtils.documents.list.invalidate();
      router.push("/invoices");
    },
  });

  const addLineItem = React.useCallback(
    () =>
      setLineItems((lineItems) =>
        lineItems.push({
          description: "",
          quantity: data.user.project_based ? DEFAULT_PROJECT_QUANTITY : DEFAULT_QUANTITY,
          hourly: !data.user.project_based,
          pay_rate_in_subunits: payRateInSubunits ?? DEFAULT_PAY_RATE,
          errors: undefined,
          id: undefined,
        }),
      ),
    [data.user.project_based, payRateInSubunits],
  );

  const updateLineItem = React.useCallback(
    (index: number, update: Partial<InvoiceFormLineItem>) =>
      setLineItems((lineItems) => updateLineItemHelper(lineItems, index, update)),
    [],
  );

  const updateExpense = React.useCallback(
    (index: number, update: Partial<InvoiceFormExpense>) =>
      setExpenses((expenses) => updateExpenseHelper(expenses, index, update)),
    [],
  );

  const removeExpense = React.useCallback((index: number) => setExpenses((expenses) => expenses.delete(index)), []);

  useEffect(() => {
    setEquityPercent(equityAllocation?.equityPercentage ?? 0);
  }, [equityAllocation]);

  const totalExpensesAmountInCents = expenses.reduce((acc, expense) => acc + expense.total_amount_in_cents, 0);
  const totalServicesAmountInCents = lineItems.reduce((acc, lineItem) => acc + lineItemTotal(lineItem), 0);
  const totalInvoiceAmountInCents = totalServicesAmountInCents + totalExpensesAmountInCents;
  const [equityCalculation] = trpc.equityCalculations.calculate.useSuspenseQuery({
    companyId: company.id,
    servicesInCents: totalServicesAmountInCents,
    invoiceYear,
    selectedPercentage: equityPercentage,
  });

  return (
    <MainLayout
      title={data.invoice.id ? "Edit invoice" : "New invoice"}
      headerActions={
        <>
          {data.invoice.id && data.invoice.status === "rejected" ? (
            <div className="inline-flex items-center">Action required</div>
          ) : (
            <Button variant="outline" asChild>
              <Link href="/invoices">Cancel</Link>
            </Button>
          )}
          <Button variant="primary" onClick={() => validate() && submit.mutate()} disabled={submit.isPending}>
            <PaperAirplaneIcon className="size-4" />
            {submit.isPending ? "Sending..." : data.invoice.id ? "Re-submit invoice" : "Send invoice"}
          </Button>
        </>
      }
    >
      {payRateInSubunits && lineItems.some((lineItem) => lineItem.pay_rate_in_subunits > payRateInSubunits) ? (
        <Alert variant="warning">
          <CircleAlert />
          <AlertDescription>
            This invoice includes rates above your default of {formatMoneyFromCents(payRateInSubunits)}/
            {data.user.project_based ? "project" : "hour"}. Please check before submitting.
          </AlertDescription>
        </Alert>
      ) : null}

      {company.equityCompensationEnabled ? (
        <section className="mb-6">
          <Card>
            <CardContent>
              <div className="grid gap-2">
                <Label htmlFor={`${uid}-equity-split`}>Confirm your equity split for {invoiceYear}</Label>
                <RangeInput
                  id={`${uid}-equity-split`}
                  value={equityPercentage}
                  onChange={setEquityPercent}
                  min={0}
                  max={MAX_EQUITY_PERCENTAGE}
                  aria-label="Cash vs equity split"
                  unit="%"
                />
              </div>
              <p className="mt-4">
                By submitting this invoice, your current equity selection will be locked for all {invoiceYear}.{" "}
                <strong>
                  You won't be able to choose a different allocation until the next options grant for {invoiceYear + 1}.
                </strong>
              </p>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section>
        <div className="grid gap-4">
          <div className="grid auto-cols-fr gap-3 md:grid-flow-col">
            <div>
              From
              <br />
              <strong>{data.user.billing_entity_name}</strong>
              <br />
              <Address address={data.invoice.bill_address} />
            </div>
            <div>
              To
              <br />
              <strong>{data.company.name}</strong>
              <br />
              <Address address={data.company.address} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="invoice-id">Invoice ID</Label>
              <Input
                id="invoice-id"
                value={invoiceNumber}
                onChange={(e) => setInvoiceNumber(e.target.value)}
                aria-invalid={errorField === "invoiceNumber"}
              />
            </div>
            <div className="flex flex-col gap-2">
              <DatePicker
                value={issueDate}
                onChange={(date) => {
                  if (date) setIssueDate(date);
                  void refetchEquityAllocation();
                }}
                aria-invalid={errorField === "issueDate"}
                label="Invoice date"
                granularity="day"
              />
            </div>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50%]">Line item</TableHead>
                <TableHead>Hours / Qty</TableHead>
                <TableHead>Rate</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {lineItems.toArray().map((item, rowIndex) => (
                <TableRow key={rowIndex}>
                  <TableCell>
                    <Input
                      value={item.description}
                      placeholder="Description"
                      aria-invalid={item.errors?.includes("description")}
                      onChange={(e) => updateLineItem(rowIndex, { description: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <QuantityInput
                      value={item.quantity ? { quantity: item.quantity, hourly: item.hourly } : null}
                      aria-label="Hours / Qty"
                      aria-invalid={item.errors?.includes("quantity")}
                      onChange={(value) =>
                        updateLineItem(rowIndex, {
                          quantity: value?.quantity ?? null,
                          hourly: value?.hourly ?? false,
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <NumberInput
                      value={item.pay_rate_in_subunits / 100}
                      onChange={(value: number | null) =>
                        updateLineItem(rowIndex, { pay_rate_in_subunits: (value ?? 0) * 100 })
                      }
                      aria-label="Rate"
                      placeholder="0"
                      prefix="$"
                      decimal
                    />
                  </TableCell>
                  <TableCell>{formatMoneyFromCents(lineItemTotal(item))}</TableCell>
                  <TableCell>
                    <Button
                      variant="link"
                      aria-label="Remove"
                      onClick={() => setLineItems((lineItems) => lineItems.delete(rowIndex))}
                    >
                      <TrashIcon className="size-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={5}>
                  <div className="flex gap-3">
                    <Button variant="link" onClick={addLineItem}>
                      <PlusIcon className="inline size-4" />
                      Add line item
                    </Button>
                    {data.company.expenses.categories.length && !showExpensesTable ? (
                      <Button variant="link" onClick={() => uploadExpenseRef.current?.click()}>
                        <ArrowUpTrayIcon className="inline size-4" />
                        Add expense
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            </TableFooter>
          </Table>
          {data.company.expenses.categories.length ? (
            <input
              ref={uploadExpenseRef}
              type="file"
              className="hidden"
              accept="application/pdf, image/*"
              multiple
              onChange={(e) => {
                const files = e.target.files;
                if (!files) return;
                const expenseCategory = assertDefined(data.company.expenses.categories[0]);
                setShowExpenses(true);
                setExpenses((expenses) =>
                  expenses.push(
                    ...[...files].map((file) => ({
                      description: "",
                      category_id: expenseCategory.id,
                      total_amount_in_cents: 0,
                      attachment: { name: file.name, url: URL.createObjectURL(file) },
                      blob: file,
                      errors: undefined,
                      id: undefined,
                    })),
                  ),
                );
              }}
            />
          ) : null}
          {showExpensesTable ? (
            <ExpenseTable
              expenses={expenses.toArray()}
              updateExpense={updateExpense}
              removeExpense={removeExpense}
              data={data}
              showExpensesTable={showExpensesTable}
              onAddExpense={() => uploadExpenseRef.current?.click()}
            />
          ) : null}

          <footer className="flex flex-col gap-3 lg:flex-row lg:justify-between">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter notes about your invoice (optional)"
              className="w-full lg:w-96"
            />
            <div className="flex flex-col gap-2 md:self-start lg:items-end">
              {showExpensesTable || equityCalculation.amountInCents > 0 ? (
                <div className="flex flex-col items-end">
                  <span>Total services</span>
                  <span className="numeric text-xl">{formatMoneyFromCents(totalServicesAmountInCents)}</span>
                </div>
              ) : null}
              {showExpensesTable ? (
                <div className="flex flex-col items-end">
                  <span>Total expenses</span>
                  <span className="numeric text-xl">{formatMoneyFromCents(totalExpensesAmountInCents)}</span>
                </div>
              ) : null}
              {equityCalculation.amountInCents > 0 ? (
                <>
                  <div className="flex flex-col items-end">
                    <span>Swapped for equity (not paid in cash)</span>
                    <span className="numeric text-xl">{formatMoneyFromCents(equityCalculation.amountInCents)}</span>
                  </div>
                  <Separator />
                  <div className="flex flex-col items-end">
                    <span>Net amount in cash</span>
                    <span className="numeric text-3xl">
                      {formatMoneyFromCents(totalInvoiceAmountInCents - equityCalculation.amountInCents)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-1 lg:items-end">
                  <span>Total</span>
                  <span className="numeric text-3xl">{formatMoneyFromCents(totalInvoiceAmountInCents)}</span>
                </div>
              )}
            </div>
          </footer>
        </div>
      </section>
    </MainLayout>
  );
};

export default Edit;
