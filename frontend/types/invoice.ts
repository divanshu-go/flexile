export type InvoiceFormLineItem = {
  id?: number | undefined;
  description: string;
  quantity: number | null;
  hourly: boolean;
  pay_rate_in_subunits: number;
  errors?: string[] | null | undefined;
};

export type InvoiceFormExpense = {
  id?: string | undefined;
  description: string;
  category_id: number;
  total_amount_in_cents: number;
  attachment: { name: string; url: string };
  errors?: string[] | null | undefined;
  blob?: File | null | undefined;
};
