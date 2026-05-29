import type { Expense } from "@/types";

const STORAGE_KEY = "expenses";

export function getExpenses(): Expense[] {
  if (typeof window === "undefined") return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    const parsed = JSON.parse(data);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e: unknown): e is Expense =>
        typeof e === "object" && e !== null && typeof (e as Expense).id === "string"
    );
  } catch {
    return [];
  }
}

export function addExpense(
  expense: Omit<Expense, "id" | "createdAt">
): Expense {
  const expenses = getExpenses();
  const newExpense: Expense = {
    ...expense,
    id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
    createdAt: new Date().toISOString(),
  };
  expenses.push(newExpense);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
  return newExpense;
}

export function deleteExpense(id: string): void {
  const expenses = getExpenses().filter((e) => e.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

export function exportToCsv(): void {
  const expenses = getExpenses();
  const header = "Date,Category,Amount,Description";
  const rows = expenses.map(
    (e) => `${e.date},${e.category},${e.amount},"${e.title.replace(/"/g, '""')}"`
  );
  const csv = [header, ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "expenses.csv";
  a.click();
  URL.revokeObjectURL(url);
}
