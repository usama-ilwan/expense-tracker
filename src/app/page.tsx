"use client";

import { useEffect, useState } from "react";
import type { Expense } from "@/types";
import { CATEGORIES } from "@/types";
import { getExpenses, deleteExpense, exportToCsv } from "@/lib/storage";

const categoryColors: Record<string, string> = {
  Food: "bg-orange-100 text-orange-700",
  Transport: "bg-blue-100 text-blue-700",
  Shopping: "bg-purple-100 text-purple-700",
  Entertainment: "bg-pink-100 text-pink-700",
  Bills: "bg-red-100 text-red-700",
  Health: "bg-green-100 text-green-700",
  Education: "bg-yellow-100 text-yellow-700",
  Other: "bg-slate-100 text-slate-700",
};

function formatDate(dateString: string) {
  const d = new Date(dateString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [filter, setFilter] = useState("");

  const load = () => setExpenses(getExpenses());
  useEffect(() => { load(); window.addEventListener("focus", load); return () => window.removeEventListener("focus", load); }, []);

  const filtered = filter
    ? expenses.filter((e) => e.category === filter)
    : expenses;

  const total = filtered.reduce((sum, e) => sum + e.amount, 0);

  const handleDelete = (id: string) => {
    deleteExpense(id);
    load();
  };

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">Total Expenses</p>
        <p className="text-3xl font-bold">{formatCurrency(total)}</p>
      </div>

      <button
        onClick={exportToCsv}
        className="cursor-pointer rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-700"
      >
        Export Data
      </button>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilter("")}
          className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !filter
              ? "bg-slate-900 text-white"
              : "bg-slate-100 text-slate-600 hover:bg-slate-200"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setFilter(cat)}
            className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              filter === cat
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-slate-200 p-12 text-center">
          <p className="text-slate-400">No expenses yet.</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {filtered
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((expense) => (
              <li
                key={expense.id}
                className="flex items-center justify-between rounded-lg border border-slate-100 bg-white p-4 transition-shadow hover:shadow-sm"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{expense.title}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${categoryColors[expense.category] || categoryColors.Other}`}
                    >
                      {expense.category}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {formatDate(expense.date)}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-semibold tabular-nums">
                    {formatCurrency(expense.amount)}
                  </span>
                  <button
                    onClick={() => handleDelete(expense.id)}
                    className="cursor-pointer text-sm text-slate-400 transition-colors hover:text-red-500"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
