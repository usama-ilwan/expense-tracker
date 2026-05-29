export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  createdAt: string;
}

export const CATEGORIES = [
  "Food",
  "Transport",
  "Shopping",
  "Entertainment",
  "Bills",
  "Health",
  "Education",
  "Other",
] as const;
