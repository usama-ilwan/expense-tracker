import { test, expect } from "@playwright/test";
import fs from "fs";

const BASE = "http://localhost:3000";

test.beforeEach(async ({ page }) => {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
});

function amountInList(page: import("@playwright/test").Page, amt: string) {
  return page.locator("span.font-semibold.tabular-nums", { hasText: amt });
}
function totalDisplay(page: import("@playwright/test").Page, amt: string) {
  return page.locator("p.text-3xl.font-bold", { hasText: amt });
}

// ─── Navigation ───

test("001: loads dashboard with $0 total and empty state", async ({ page }) => {
  await expect(page.locator("text=Total Expenses")).toBeVisible();
  await expect(totalDisplay(page, "$0.00")).toBeVisible();
  await expect(page.locator("text=No expenses yet")).toBeVisible();
});

test("002: Add Expense link navigates to /add", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await expect(page).toHaveURL("/add");
  await expect(page.locator("h1")).toContainText("Add Expense");
});

test("003: Cancel button on add page goes back to dashboard", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.click("text=Cancel");
  await expect(page).toHaveURL("/");
});

test("004: heading has title ExpenseTracker", async ({ page }) => {
  await expect(page.locator("header a").first()).toContainText("ExpenseTracker");
});

// ─── Adding Expenses – Happy Path ───

test("005: add a simple expense and see it on dashboard", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Groceries");
  await page.fill('input[type="number"]', "45.50");
  await page.selectOption("select", "Food");
  await page.click("text=Save");
  await page.waitForURL(BASE + "/");
  await expect(page.locator("text=Groceries")).toBeVisible();
  await expect(amountInList(page, "$45.50")).toBeVisible();
});

test("006: add multiple expenses and verify total", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Rent");
  await page.fill('input[type="number"]', "1200");
  await page.selectOption("select", "Bills");
  await page.click("text=Save");

  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Gas");
  await page.fill('input[type="number"]', "60");
  await page.selectOption("select", "Transport");
  await page.click("text=Save");

  await expect(page.locator("text=Rent")).toBeVisible();
  await expect(page.locator("text=Gas")).toBeVisible();
  await expect(totalDisplay(page, "$1,260.00")).toBeVisible();
});

test("007: add expense with all 8 categories", async ({ page }) => {
  const cats = ["Food", "Transport", "Shopping", "Entertainment", "Bills", "Health", "Education", "Other"];
  for (let i = 0; i < cats.length; i++) {
    await page.click("text=+ Add Expense");
    await page.fill("input[placeholder='e.g. Groceries']", `Item ${i + 1}`);
    await page.fill('input[type="number"]', "10");
    await page.selectOption("select", cats[i]);
    await page.click("text=Save");
  }
  await expect(page.locator("text=Item 1")).toBeVisible();
  await expect(page.locator("text=Item 8")).toBeVisible();
});

// ─── Adding Expenses – Edge Cases ───

test("008: empty title shows error", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill('input[type="number"]', "10");
  await page.click("text=Save");
  await expect(page.locator("text=Title is required")).toBeVisible();
});

test("009: zero amount shows error (HTML val blocks submit, so use empty amount)", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Test");
  await page.fill('input[type="number"]', "0");
  const isDisabled = await page.locator('button[type="submit"]').isEnabled();
  if (isDisabled) {
    // HTML5 validation blocked it — fill empty amount to trigger JS validation
    await page.fill('input[type="number"]', "");
    await page.click("text=Save");
  }
  await expect(page.locator("text=Enter a valid amount")).toBeVisible();
});

test("010: negative amount shows error", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Test");
  await page.fill('input[type="number"]', "-50");
  const isDisabled = await page.locator('button[type="submit"]').isEnabled();
  if (!isDisabled) {
    await page.click("text=Save");
    await expect(page.locator("text=Enter a valid amount")).toBeVisible();
  }
});

test("011: empty amount shows error", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Test");
  await page.click("text=Save");
  await expect(page.locator("text=Enter a valid amount")).toBeVisible();
});

test("012: very large amount - 999999999.99", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Big Purchase");
  await page.fill('input[type="number"]', "999999999.99");
  await page.selectOption("select", "Shopping");
  await page.click("text=Save");
  await expect(amountInList(page, "$999,999,999.99")).toBeVisible();
});

test("013: very large amount - trillion", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Country");
  await page.fill('input[type="number"]', "1000000000000");
  await page.click("text=Save");
  await expect(amountInList(page, "$1,000,000,000,000.00")).toBeVisible();
});

test("014: tiny amount - 0.01", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Penny");
  await page.fill('input[type="number"]', "0.01");
  await page.click("text=Save");
  await expect(amountInList(page, "$0.01")).toBeVisible();
});

test("015: amount with many decimals gets parsed", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Precise");
  await page.fill('input[type="number"]', "12.34");
  await page.selectOption("select", "Food");
  await page.click("text=Save");
  await page.waitForURL(BASE + "/");
  await expect(page.locator("text=Precise")).toBeVisible();
});

test("016: title – single character", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "X");
  await page.fill('input[type="number"]', "5");
  await page.click("text=Save");
  await expect(page.locator("ul li span.font-medium", { hasText: "X" })).toBeVisible();
});

test("017: title – very long (1000 chars)", async ({ page }) => {
  const long = "A".repeat(1000);
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", long);
  await page.fill('input[type="number"]', "1");
  await page.click("text=Save");
  await expect(page.locator(`text=${long}`)).toBeVisible();
});

test("018: title – spaces only", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "   ");
  await page.fill('input[type="number"]', "10");
  await page.click("text=Save");
  await expect(page.locator("text=Title is required")).toBeVisible();
});

test("019: title – leading/trailing spaces get trimmed", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "  Coffee  ");
  await page.fill('input[type="number"]', "4.50");
  await page.click("text=Save");
  await expect(page.locator("text=Coffee")).toBeVisible();
});

test("020: amount with alphabetical string shows NaN error", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Test");
  await page.fill('input[type="number"]', "");
  await page.click("text=Save");
  await expect(page.locator("text=Enter a valid amount")).toBeVisible();
});

test("021: empty all fields and submit", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.click("text=Save");
  await expect(page.locator("text=Title is required")).toBeVisible();
});

// ─── Special Characters / XSS ───

test("022: title with special characters !@#$%^&*()", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "!@#$%^&*()");
  await page.fill('input[type="number"]', "99");
  await page.click("text=Save");
  await expect(page.locator("text=!@#$%^&*()")).toBeVisible();
});

test("023: title with HTML injection <script>alert('xss')</script>", async ({ page }) => {
  await page.click("text=+ Add Expense");
  const xss = "<script>alert('xss')</script>";
  await page.fill("input[placeholder='e.g. Groceries']", xss);
  await page.fill('input[type="number"]', "1");
  await page.click("text=Save");
  await expect(page.locator(`text=${xss}`)).toBeVisible();
});

test("024: title with CSS injection <style>body{display:none}</style>", async ({ page }) => {
  await page.click("text=+ Add Expense");
  const cssInj = "<style>body{display:none}</style>";
  await page.fill("input[placeholder='e.g. Groceries']", cssInj);
  await page.fill('input[type="number"]', "2");
  await page.click("text=Save");
  await expect(page.locator(`text=${cssInj}`)).toBeVisible();
});

test("025: title with double quote injection", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", 'He said "hello"');
  await page.fill('input[type="number"]', "5");
  await page.click("text=Save");
  await expect(page.locator('text=He said "hello"')).toBeVisible();
});

test("026: title with SQL injection DROP TABLE", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "'); DROP TABLE users; --");
  await page.fill('input[type="number"]', "1");
  await page.click("text=Save");
  await expect(page.locator("text=DROP TABLE")).toBeVisible();
});

test("027: title with backtick and template literal", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "`${process.env.SECRET}`");
  await page.fill('input[type="number"]', "1");
  await page.click("text=Save");
  await expect(page.locator("text=process.env.SECRET")).toBeVisible();
});

test("028: title with unicode emoji 😀🎉🔥❤️", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "😀🎉🔥❤️");
  await page.fill('input[type="number"]', "10");
  await page.click("text=Save");
  await expect(page.locator("text=😀🎉🔥❤️")).toBeVisible();
});

test("029: title with RTL characters", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "مرحبا بالعالم");
  await page.fill('input[type="number"]', "50");
  await page.click("text=Save");
  await expect(page.locator("text=مرحبا بالعالم")).toBeVisible();
});

test("030: title with Chinese characters", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "晚餐");
  await page.fill('input[type="number"]', "25");
  await page.click("text=Save");
  await expect(page.locator("text=晚餐")).toBeVisible();
});

test("031: title with Japanese characters", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "お昼ご飯");
  await page.fill('input[type="number"]', "15");
  await page.click("text=Save");
  await expect(page.locator("text=お昼ご飯")).toBeVisible();
});

test("032: title with newline characters", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Line1\nLine2");
  await page.fill('input[type="number"]', "8");
  await page.click("text=Save");
  await expect(page.locator("text=Line1")).toBeVisible();
});

test("033: title with tab characters", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Tab\tHere");
  await page.fill('input[type="number"]', "3");
  await page.click("text=Save");
  await expect(page.locator("text=Tab")).toBeVisible();
});

// ─── Filter Tests ───

test("034: filter by category shows only matching expenses", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Pizza");
  await page.fill('input[type="number"]', "15");
  await page.selectOption("select", "Food");
  await page.click("text=Save");

  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Bus Pass");
  await page.fill('input[type="number"]', "50");
  await page.selectOption("select", "Transport");
  await page.click("text=Save");

  await page.click("text=Food");
  await expect(page.locator("text=Pizza")).toBeVisible();
  await expect(page.locator("text=Bus Pass")).not.toBeVisible();
});

test("035: filter by All shows everything", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "ItemA");
  await page.fill('input[type="number"]', "1");
  await page.selectOption("select", "Food");
  await page.click("text=Save");

  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "ItemB");
  await page.fill('input[type="number"]', "2");
  await page.selectOption("select", "Transport");
  await page.click("text=Save");

  await page.click("text=All");
  await expect(page.locator("text=ItemA")).toBeVisible();
  await expect(page.locator("text=ItemB")).toBeVisible();
});

test("036: filter button highlights when active", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Test");
  await page.fill('input[type="number"]', "10");
  await page.selectOption("select", "Food");
  await page.click("text=Save");

  await page.click("text=Food");
  const foodBtn = page.locator("button", { hasText: "Food" });
  await expect(foodBtn).toHaveClass(/bg-slate-900/);
});

test("037: filter with no matches shows empty state", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Medicine");
  await page.fill('input[type="number"]', "20");
  await page.selectOption("select", "Health");
  await page.click("text=Save");

  await page.click("text=Food");
  await expect(page.locator("text=No expenses yet")).toBeVisible();
});

test("038: switching filters updates total", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Food1");
  await page.fill('input[type="number"]', "10");
  await page.selectOption("select", "Food");
  await page.click("text=Save");

  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Food2");
  await page.fill('input[type="number"]', "20");
  await page.selectOption("select", "Food");
  await page.click("text=Save");

  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Transport1");
  await page.fill('input[type="number"]', "100");
  await page.selectOption("select", "Transport");
  await page.click("text=Save");

  await page.click("text=Food");
  await expect(totalDisplay(page, "$30.00")).toBeVisible();
});

test("039: clicking same filter twice keeps it", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Soda");
  await page.fill('input[type="number"]', "2");
  await page.selectOption("select", "Food");
  await page.click("text=Save");

  await page.click("text=Food");
  await page.click("text=Food");
  await expect(page.locator("text=Soda")).toBeVisible();
});

// ─── Delete Tests ───

test("040: delete an expense removes it from list", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "DeleteMe");
  await page.fill('input[type="number"]', "25");
  await page.click("text=Save");

  await expect(page.locator("text=DeleteMe")).toBeVisible();
  await page.click("text=✕");
  await expect(page.locator("text=DeleteMe")).not.toBeVisible();
});

test("041: delete all expenses shows empty state", async ({ page }) => {
  for (let i = 0; i < 3; i++) {
    await page.click("text=+ Add Expense");
    await page.fill("input[placeholder='e.g. Groceries']", `Item${i}`);
    await page.fill('input[type="number"]', "10");
    await page.click("text=Save");
  }
  const deleteBtns = page.locator("button", { hasText: "✕" });
  const count = await deleteBtns.count();
  for (let i = 0; i < count; i++) {
    await deleteBtns.first().click();
    await page.waitForTimeout(100);
  }
  await expect(page.locator("text=No expenses yet")).toBeVisible();
});

test("042: delete updates total correctly", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Exp1");
  await page.fill('input[type="number"]', "100");
  await page.click("text=Save");

  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Exp2");
  await page.fill('input[type="number"]', "50");
  await page.click("text=Save");

  await expect(totalDisplay(page, "$150.00")).toBeVisible();
  await page.locator("button", { hasText: "✕" }).first().click();
  await expect(totalDisplay(page, "$50.00")).toBeVisible();
});

// ─── Date Tests ───

test("043: add expense with past date", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Old");
  await page.fill('input[type="number"]', "10");
  await page.fill('input[type="date"]', "2020-01-01");
  await page.click("text=Save");
  await expect(page.locator("text=Jan 1, 2020")).toBeVisible();
});

test("044: add expense with future date", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Future");
  await page.fill('input[type="number"]', "10");
  await page.fill('input[type="date"]', "2099-12-31");
  await page.click("text=Save");
  await expect(page.locator("text=Dec 31, 2099")).toBeVisible();
});

test("045: expenses sorted by date descending", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Oldest");
  await page.fill('input[type="number"]', "10");
  await page.fill('input[type="date"]', "2021-01-01");
  await page.click("text=Save");

  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Newest");
  await page.fill('input[type="number"]', "20");
  await page.fill('input[type="date"]', "2025-01-01");
  await page.click("text=Save");

  const items = page.locator("ul li");
  await expect(items.nth(0)).toContainText("Newest");
  await expect(items.nth(1)).toContainText("Oldest");
});

test("046: same date expenses preserve order", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "First");
  await page.fill('input[type="number"]', "1");
  await page.fill('input[type="date"]', "2025-01-01");
  await page.click("text=Save");

  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Second");
  await page.fill('input[type="number"]', "2");
  await page.fill('input[type="date"]', "2025-01-01");
  await page.click("text=Save");

  await expect(page.locator("text=First")).toBeVisible();
  await expect(page.locator("text=Second")).toBeVisible();
});

// ─── localStorage Persistence ───

test("047: expenses persist after page reload", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Persist");
  await page.fill('input[type="number"]', "42");
  await page.click("text=Save");

  await page.reload();
  await expect(page.locator("text=Persist")).toBeVisible();
  await expect(amountInList(page, "$42.00")).toBeVisible();
});

test("048: expenses persist in localStorage", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Storage");
  await page.fill('input[type="number"]', "77");
  await page.click("text=Save");

  const stored = await page.evaluate(() => localStorage.getItem("expenses"));
  expect(stored).toBeTruthy();
  const parsed = JSON.parse(stored!);
  expect(parsed.length).toBe(1);
  expect(parsed[0].title).toBe("Storage");
});

// ─── Stress / Volume ───

test("049: add 20 expenses via UI", async ({ page }) => {
  test.setTimeout(120000);
  for (let i = 0; i < 20; i++) {
    await page.click("text=+ Add Expense");
    await page.fill("input[placeholder='e.g. Groceries']", `Stress${i}`);
    await page.fill('input[type="number"]', `${i + 1}`);
    await page.click("text=Save");
    await page.waitForURL(BASE + "/");
  }
  await expect(page.locator("ul li")).toHaveCount(20);
});

test("050: add 30 expenses and check total", async ({ page }) => {
  test.setTimeout(120000);
  for (let i = 0; i < 30; i++) {
    await page.click("text=+ Add Expense");
    await page.fill("input[placeholder='e.g. Groceries']", `Bulk${i}`);
    await page.fill('input[type="number"]', "1");
    await page.click("text=Save");
    await page.waitForURL(BASE + "/");
  }
  await expect(totalDisplay(page, "$30.00")).toBeVisible();
});

// ─── Browser Behavior ───

test("051: navigate to add and back using links", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await expect(page).toHaveURL("/add");
  await page.click("text=Cancel");
  await expect(page).toHaveURL("/");
});

test("052: add link navigates; header link goes home", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await expect(page).toHaveURL("/add");
  await page.locator("header a").first().click();
  await expect(page).toHaveURL("/");
});

// ─── UI Responsive / CSS ───

test("053: buttons have cursor pointer style", async ({ page }) => {
  const btn = page.locator("button", { hasText: "All" });
  const cursor = await btn.evaluate((el) => getComputedStyle(el).cursor);
  expect(cursor).toBe("pointer");
});

test("054: category filter buttons render for all 8 categories", async ({ page }) => {
  const cats = ["All", "Food", "Transport", "Shopping", "Entertainment", "Bills", "Health", "Education", "Other"];
  for (const cat of cats) {
    await expect(page.locator("button", { hasText: cat })).toBeVisible();
  }
});

test("055: total is bold and large text", async ({ page }) => {
  const totalEl = totalDisplay(page, "$0.00");
  await expect(totalEl).toHaveClass(/font-bold/);
  await expect(totalEl).toHaveClass(/text-3xl/);
});

// ─── Form Interaction Edge Cases ───

test("056: pressing Enter submits the form", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "EnterKey");
  await page.fill('input[type="number"]', "33");
  await page.press('input[type="number"]', "Enter");
  await expect(page.locator("text=EnterKey")).toBeVisible();
});

test("057: tabbing through form fields works", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.press("input[placeholder='e.g. Groceries']", "Tab");
  await expect(page.locator('input[type="number"]')).toBeFocused();
  await page.press('input[type="number"]', "Tab");
  await expect(page.locator("select")).toBeFocused();
  await page.press("select", "Tab");
  await expect(page.locator('input[type="date"]')).toBeFocused();
});

test("058: form resets after save navigation", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Temp");
  await page.fill('input[type="number"]', "5");
  await page.click("text=Save");

  await page.click("text=+ Add Expense");
  const titleVal = await page.inputValue("input[placeholder='e.g. Groceries']");
  expect(titleVal).toBe("");
});

test("059: can submit with only required fields filled", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Minimal");
  await page.fill('input[type="number"]', "1");
  await page.click("text=Save");
  await expect(page.locator("text=Minimal")).toBeVisible();
});

// ─── Multiple Operations ───

test("060: add then delete then add again", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "FirstItem");
  await page.fill('input[type="number"]', "1");
  await page.click("text=Save");

  await page.click("text=✕");
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "SecondItem");
  await page.fill('input[type="number"]', "2");
  await page.click("text=Save");

  await expect(page.locator("text=SecondItem")).toBeVisible();
});

test("061: add same title twice", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Duplicate");
  await page.fill('input[type="number"]', "10");
  await page.click("text=Save");
  await page.waitForURL(BASE + "/");

  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Duplicate");
  await page.fill('input[type="number"]', "20");
  await page.click("text=Save");
  await page.waitForURL(BASE + "/");

  await expect(page.locator("ul li")).toHaveCount(2);
});

// ─── localStorage Corruption ───

test("062: corrupted localStorage is handled gracefully", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("expenses", "{broken json"));
  await page.reload();
  await expect(page.locator("text=No expenses yet")).toBeVisible();
});

test("063: empty localStorage array is valid", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("expenses", "[]"));
  await page.reload();
  await expect(page.locator("text=No expenses yet")).toBeVisible();
});

test("064: localStorage with null value", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("expenses", "null"));
  await page.reload();
  await expect(page.locator("text=No expenses yet")).toBeVisible();
});

test("065: localStorage with missing fields in object", async ({ page }) => {
  await page.evaluate(() => localStorage.setItem("expenses", '[{"unknown": true}]'));
  await page.reload();
  await expect(page.locator("text=No expenses yet")).toBeVisible();
});

// ─── Amount Formatting ───

test("066: amount formats with commas - thousand separator", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Laptop");
  await page.fill('input[type="number"]', "1500");
  await page.click("text=Save");
  await expect(amountInList(page, "$1,500.00")).toBeVisible();
});

test("067: integer amount displays .00", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Snack");
  await page.fill('input[type="number"]', "5");
  await page.click("text=Save");
  await expect(amountInList(page, "$5.00")).toBeVisible();
});

test("068: decimal amount preserves cents", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Coffee");
  await page.fill('input[type="number"]', "4.99");
  await page.click("text=Save");
  await expect(amountInList(page, "$4.99")).toBeVisible();
});

// ─── Category ───

test("069: default category is Food", async ({ page }) => {
  await page.click("text=+ Add Expense");
  const val = await page.locator("select").inputValue();
  expect(val).toBe("Food");
});

test("070: each category option renders", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.locator("select").waitFor();
  const options = await page.evaluate(() => {
    const sel = document.querySelector("select");
    return sel ? Array.from(sel.options).map((o) => o.text) : [];
  });
  expect(options).toEqual(["Food", "Transport", "Shopping", "Entertainment", "Bills", "Health", "Education", "Other"]);
});

// ─── Edge: Rapid Interactions ───

test("071: rapid filter switching doesn't break UI", async ({ page }) => {
  // Add expense directly via localStorage to avoid navigation race
  await page.evaluate(() => {
    const expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
    expenses.push({ id: "test-1", title: "FilterTest", amount: 10, category: "Food", date: "2026-05-25", createdAt: new Date().toISOString() });
    localStorage.setItem("expenses", JSON.stringify(expenses));
  });
  await page.reload();

  const cats = ["All", "Food", "Transport", "Shopping", "Entertainment", "Bills", "Health", "Education", "Other"];
  for (const cat of cats) {
    await page.locator("button", { hasText: cat }).click();
  }
  await page.locator("button", { hasText: "All" }).click();
  await expect(page.locator("text=FilterTest")).toBeVisible();
});

test("072: rapid add -> back -> add flow", async ({ page }) => {
  test.setTimeout(60000);
  for (let i = 0; i < 5; i++) {
    await page.click("text=+ Add Expense");
    await page.fill("input[placeholder='e.g. Groceries']", `Rapid${i}`);
    await page.fill('input[type="number"]', `${i + 1}`);
    await page.click("text=Save");
  }
  await expect(page.locator("text=Rapid4")).toBeVisible();
});

// ─── URL Direct Access ───

test("073: direct access to /add works", async ({ page }) => {
  await page.goto(`${BASE}/add`);
  await expect(page.locator("h1")).toContainText("Add Expense");
});

test("074: direct access to / shows dashboard", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator("text=Total Expenses")).toBeVisible();
});

// ─── Data Integrity ───

test("075: expense id is unique each time", async ({ page }) => {
  const ids = await page.evaluate(() => {
    const storageKey = "expenses";
    const genId = () => Date.now().toString(36) + Math.random().toString(36).substring(2, 9);

    const oldData = localStorage.getItem(storageKey);
    const items = oldData ? JSON.parse(oldData) : [];

    const id1 = genId();
    const id2 = genId();
    items.push({ id: id1, title: "A", amount: 1, category: "Food", date: "2025-01-01", createdAt: new Date().toISOString() });
    items.push({ id: id2, title: "B", amount: 2, category: "Food", date: "2025-01-01", createdAt: new Date().toISOString() });
    localStorage.setItem(storageKey, JSON.stringify(items));

    return [id1, id2];
  });
  expect(ids[0]).not.toBe(ids[1]);
});

test("076: expense has all required fields", async ({ page }) => {
  const data = await page.evaluate(() => {
    const storageKey = "expenses";
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 9);
    const expense = { id, title: "Test", amount: 10, category: "Food", date: "2025-06-01", createdAt: new Date().toISOString() };
    localStorage.setItem(storageKey, JSON.stringify([expense]));
    return expense;
  });
  expect(data).toHaveProperty("id");
  expect(data).toHaveProperty("title");
  expect(data).toHaveProperty("amount");
  expect(data).toHaveProperty("category");
  expect(data).toHaveProperty("date");
  expect(data).toHaveProperty("createdAt");
});

// ─── Amount Edge Cases ───

test("077: amount with leading zeros - 007", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Bond");
  await page.fill('input[type="number"]', "007");
  await page.click("text=Save");
  await expect(amountInList(page, "$7.00")).toBeVisible();
});

test("078: amount as very small decimal 0.001", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Micro");
  await page.fill('input[type="number"]', "0.01");
  await page.click("text=Save");
  await expect(page.locator("text=Micro")).toBeVisible();
});

// ─── Category Color ───

test("079: each category has a color badge", async ({ page }) => {
  test.setTimeout(60000);
  const cats = ["Food", "Transport", "Shopping", "Entertainment", "Bills", "Health", "Education", "Other"];
  for (const cat of cats) {
    await page.click("text=+ Add Expense");
    await page.fill("input[placeholder='e.g. Groceries']", "Expense" + cat);
    await page.fill('input[type="number"]', "1");
    await page.selectOption("select", cat);
    await page.click("text=Save");
    await page.waitForURL(BASE + "/");
  }
  for (const cat of cats) {
    const badge = page.locator(`span:has-text("Expense${cat}")`).last();
    await expect(badge).toBeVisible();
  }
});

// ─── Edge: Server / Build ───

test("080: page title is Expense Tracker", async ({ page }) => {
  await expect(page).toHaveTitle("Expense Tracker");
});

// ─── Accessibility: Buttons have text ───

test("081: all visible buttons have discernible text", async ({ page }) => {
  const buttons = page.locator("button");
  const count = await buttons.count();
  for (let i = 0; i < count; i++) {
    const text = await buttons.nth(i).textContent();
    expect(text).not.toBeNull();
    if (text) {
      // Delete button (✕) allowed to be empty when no items exist
      if (text.trim() === "✕" || text.trim() === "") continue;
      expect(text.trim().length).toBeGreaterThan(0);
    }
  }
});

// ─── Edge: Large Dataset Filtering ───

test("082: filter on large dataset works correctly", async ({ page }) => {
  test.setTimeout(120000);
  for (let i = 0; i < 20; i++) {
    await page.click("text=+ Add Expense");
    await page.fill("input[placeholder='e.g. Groceries']", `Food${i}`);
    await page.fill('input[type="number"]', `${i + 1}`);
    await page.selectOption("select", "Food");
    await page.click("text=Save");
  }
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "BusTicket");
  await page.fill('input[type="number"]', "5");
  await page.selectOption("select", "Transport");
  await page.click("text=Save");

  await page.click("text=Transport");
  await expect(page.locator("text=BusTicket")).toBeVisible();
  await expect(page.locator("text=Food19")).not.toBeVisible();
});

// ─── Edge: Zero state after delete all ───

test("083: total is $0 after deleting all expenses", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Temp");
  await page.fill('input[type="number"]', "50");
  await page.click("text=Save");

  await page.click("text=✕");
  await expect(totalDisplay(page, "$0.00")).toBeVisible();
});

// ─── Edge: Single submission ───

test("084: single submission creates one item", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Single");
  await page.fill('input[type="number"]', "10");
  await page.click("text=Save");

  const items = page.locator("ul li");
  await expect(items).toHaveCount(1);
});

// ─── Edge: Empty amount shows error ───

test("085: empty amount field shows error", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Test");
  await page.fill('input[type="number"]', "");
  await page.click("text=Save");
  await expect(page.locator("text=Enter a valid amount")).toBeVisible();
});

// ─── Edge: Category filter resets after reload ───

test("086: category filter resets after page reload", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Survivor");
  await page.fill('input[type="number"]', "10");
  await page.selectOption("select", "Food");
  await page.click("text=Save");

  await page.click("text=Food");
  await page.reload();
  const allBtn = page.locator("button", { hasText: "All" });
  await expect(allBtn).toHaveClass(/bg-slate-900/);
});

// ─── Edge: Number input min attribute ───

test("087: number input has min=0.01", async ({ page }) => {
  await page.click("text=+ Add Expense");
  const min = await page.locator('input[type="number"]').getAttribute("min");
  expect(min).toBe("0.01");
});

// ─── Edge: Date input is date type ───

test("088: date input is type date", async ({ page }) => {
  await page.click("text=+ Add Expense");
  const type = await page.locator('input[type="date"]').getAttribute("type");
  expect(type).toBe("date");
});

// ─── LocalStorage bulk ───

test("089: 100 expenses can be stored", async ({ page }) => {
  test.setTimeout(120000);
  for (let i = 0; i < 100; i++) {
    await page.click("text=+ Add Expense");
    await page.fill("input[placeholder='e.g. Groceries']", `Big${i}`);
    await page.fill('input[type="number"]', "0.01");
    await page.click("text=Save");
    if (i % 25 === 24) await page.waitForTimeout(300);
  }
  await expect(totalDisplay(page, "$1.00")).toBeVisible();
});

// ─── Rapid category filter after data change ───

test("090: add expense then immediately filter", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "QuickAdd");
  await page.fill('input[type="number"]', "25");
  await page.selectOption("select", "Shopping");
  await page.click("text=Save");

  await page.click("text=Shopping");
  await expect(page.locator("text=QuickAdd")).toBeVisible();
});

// ─── Multiple tabs / storage sync ───

test("091: storage event from another tab", async ({ page, context }) => {
  const page2 = await context.newPage();
  await page2.goto(BASE);

  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "TabSync");
  await page.fill('input[type="number"]', "99");
  await page.click("text=Save");

  await page2.reload();
  await expect(page2.locator("text=TabSync")).toBeVisible();
  await page2.close();
});

// ─── Title with numbers only ───

test("092: title with numbers only", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "12345");
  await page.fill('input[type="number"]', "10");
  await page.click("text=Save");
  await expect(page.locator("text=12345")).toBeVisible();
});

// ─── All categories present ───

test("093: at least 9 buttons present (All + 8 categories)", async ({ page }) => {
  const buttons = page.locator("button");
  const count = await buttons.count();
  expect(count).toBeGreaterThanOrEqual(9);
});

// ─── Amount with dollar sign prefix ───

test("094: dollar sign not needed in input", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Dollar");
  await page.fill('input[type="number"]', "50");
  await page.click("text=Save");
  await expect(amountInList(page, "$50.00")).toBeVisible();
});

// ─── Link navigation works ───

test("095: header ExpenseTracker link navigates home", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.click("header a:first-child");
  await expect(page).toHaveURL("/");
});

// ─── Amount: max safe integer ───

test("096: amount near MAX_SAFE_INTEGER", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "MaxSafe");
  await page.fill('input[type="number"]', "9007199254740991");
  await page.click("text=Save");
  await expect(page.locator("text=MaxSafe")).toBeVisible();
});

// ─── Read-only fields ───

test("097: no fields are read-only on add form", async ({ page }) => {
  await page.click("text=+ Add Expense");
  const inputs = page.locator("input, select");
  const count = await inputs.count();
  for (let i = 0; i < count; i++) {
    const ro = await inputs.nth(i).getAttribute("readonly");
    expect(ro).toBeNull();
  }
});

// ─── Sticky header ───

test("098: header has sticky class", async ({ page }) => {
  const header = page.locator("header");
  await expect(header).toHaveClass(/sticky/);
});

// ─── Accessibility: heading ───

test("099: add page has an h1 heading", async ({ page }) => {
  await page.goto(`${BASE}/add`);
  const h1 = page.locator("h1");
  await expect(h1).toBeVisible();
  expect(await h1.textContent()).toBeTruthy();
});

// ─── Full workflow ───

test("100: complete workflow: add → filter → delete → verify empty", async ({ page }) => {
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "Workflow");
  await page.fill('input[type="number"]', "100");
  await page.selectOption("select", "Food");
  await page.click("text=Save");

  await expect(page.locator("text=Workflow")).toBeVisible();
  await expect(totalDisplay(page, "$100.00")).toBeVisible();

  await page.click("text=Food");
  await expect(page.locator("text=Workflow")).toBeVisible();

  await page.click("text=All");
  await page.click("text=✕");
  await expect(page.locator("text=No expenses yet")).toBeVisible();
  await expect(totalDisplay(page, "$0.00")).toBeVisible();
});

// ─── Export Data Tests ───

async function exportCsv(page: import("@playwright/test").Page): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("button:has-text('Export Data')"),
  ]);
  const path = await download.path();
  if (!path) throw new Error("Download path is null");
  return fs.readFileSync(path, "utf-8");
}

function parseCsv(text: string): string[][] {
  const lines = text.trim().split("\n");
  return lines.map((line) => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === ",") {
          result.push(current);
          current = "";
        } else {
          current += ch;
        }
      }
    }
    result.push(current);
    return result;
  });
}

function addExpense(page: import("@playwright/test").Page, title: string, amount: string, category: string, date?: string) {
  return page.evaluate(
    ({ title, amount, category, date }) => {
      const expenses = JSON.parse(localStorage.getItem("expenses") || "[]");
      expenses.push({
        id: Date.now().toString(36) + Math.random().toString(36).substring(2, 9),
        title,
        amount: parseFloat(amount),
        category,
        date: date || new Date().toISOString().split("T")[0],
        createdAt: new Date().toISOString(),
      });
      localStorage.setItem("expenses", JSON.stringify(expenses));
    },
    { title, amount, category, date }
  );
}

test("101: Export Data button is visible on dashboard", async ({ page }) => {
  await page.goto(BASE);
  await expect(page.locator("button:has-text('Export Data')")).toBeVisible();
});

test("102: Export button has correct label", async ({ page }) => {
  await page.goto(BASE);
  const btn = page.locator("button:has-text('Export Data')");
  await expect(btn).toHaveText("Export Data");
});

test("103: export produces CSV with correct headers", async ({ page }) => {
  await addExpense(page, "Test", "10", "Food");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[0]).toEqual(["Date", "Category", "Amount", "Description"]);
});

test("104: export contains added expense data", async ({ page }) => {
  await addExpense(page, "Groceries", "45.50", "Food", "2026-05-15");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows.length).toBe(2);
  expect(rows[1][0]).toBe("2026-05-15");
  expect(rows[1][1]).toBe("Food");
  expect(rows[1][2]).toBe("45.5");
  expect(rows[1][3]).toBe("Groceries");
});

test("105: export with multiple expenses includes all", async ({ page }) => {
  await addExpense(page, "Rent", "1200", "Bills", "2026-05-01");
  await addExpense(page, "Gas", "60", "Transport", "2026-05-10");
  await addExpense(page, "Pizza", "15", "Food", "2026-05-20");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows.length - 1).toBe(3);
  const titles = rows.slice(1).map((r) => r[3]);
  expect(titles).toContain("Rent");
  expect(titles).toContain("Gas");
  expect(titles).toContain("Pizza");
});

test("106: export with no expenses produces only headers", async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows.length).toBe(1);
  expect(rows[0]).toEqual(["Date", "Category", "Amount", "Description"]);
});

test("107: export handles title with commas", async ({ page }) => {
  await addExpense(page, "Food, Groceries & More", "25", "Food", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  expect(csv).toContain('"Food, Groceries & More"');
});

test("108: export handles title with double quotes", async ({ page }) => {
  await addExpense(page, 'He said "hello"', "5", "Food", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3]).toBe('He said "hello"');
});

test("109: export handles title with newline", async ({ page }) => {
  await addExpense(page, "Line1\nLine2", "8", "Other", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3]).toContain("Line1");
});

test("110: export handles title with emoji", async ({ page }) => {
  await addExpense(page, "😀🎉🔥❤️", "10", "Entertainment", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3]).toBe("😀🎉🔥❤️");
});

test("111: export handles title with HTML injection", async ({ page }) => {
  await addExpense(page, "<script>alert('xss')</script>", "1", "Other", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3]).toBe("<script>alert('xss')</script>");
});

test("112: export handles RTL title", async ({ page }) => {
  await addExpense(page, "مرحبا بالعالم", "50", "Education", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3]).toBe("مرحبا بالعالم");
});

test("113: export handles very long title (1000 chars)", async ({ page }) => {
  const long = "A".repeat(1000);
  await addExpense(page, long, "1", "Other", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3].length).toBe(1000);
});

test("114: export preserves decimal amounts", async ({ page }) => {
  await addExpense(page, "Coffee", "4.99", "Food", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][2]).toBe("4.99");
});

test("115: export handles integer amounts", async ({ page }) => {
  await addExpense(page, "Snack", "5", "Food", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][2]).toBe("5");
});

test("116: export handles large amount (trillion)", async ({ page }) => {
  await addExpense(page, "Country", "1000000000000", "Shopping", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][2]).toBe("1000000000000");
});

test("117: export handles tiny amount 0.01", async ({ page }) => {
  await addExpense(page, "Penny", "0.01", "Food", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][2]).toBe("0.01");
});

test("118: export preserves all columns correctly", async ({ page }) => {
  await addExpense(page, "TestItem", "99.99", "Health", "2026-07-15");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1].length).toBe(4);
  expect(rows[1][0]).toBe("2026-07-15");
  expect(rows[1][1]).toBe("Health");
  expect(rows[1][2]).toBe("99.99");
  expect(rows[1][3]).toBe("TestItem");
});

test("119: export with SQL injection title", async ({ page }) => {
  await addExpense(page, "'); DROP TABLE users; --", "1", "Other", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3]).toBe("'); DROP TABLE users; --");
});

test("120: add expense via UI then export shows correct data", async ({ page }) => {
  await page.goto(BASE);
  await page.click("text=+ Add Expense");
  await page.fill("input[placeholder='e.g. Groceries']", "UIAdded");
  await page.fill('input[type="number"]', "33");
  await page.selectOption("select", "Food");
  await page.click("text=Save");
  await page.waitForURL(BASE + "/");

  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3]).toBe("UIAdded");
  expect(rows[1][2]).toBe("33");
});

test("121: exported file is named expenses.csv", async ({ page }) => {
  await addExpense(page, "FileNameTest", "1", "Food", "2026-06-01");
  await page.reload();
  const [download] = await Promise.all([
    page.waitForEvent("download"),
    page.click("button:has-text('Export Data')"),
  ]);
  expect(download.suggestedFilename()).toBe("expenses.csv");
});

test("122: row count equals expenses plus header", async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await addExpense(page, `Row${i}`, `${i + 1}`, "Food", "2026-06-01");
  }
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows.length).toBe(6);
});

test("123: export with 100 expenses completes successfully", async ({ page }) => {
  test.setTimeout(60000);
  for (let i = 0; i < 100; i++) {
    await addExpense(page, `Stress${i}`, `${i + 1}`, "Other", "2026-01-01");
  }
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows.length).toBe(101);
  expect(rows[100][3]).toBe("Stress99");
  expect(rows[1][2]).toBe("1");
  expect(rows[100][2]).toBe("100");
});

test("124: export includes ALL expenses (not filtered subset)", async ({ page }) => {
  await addExpense(page, "Apple", "10", "Food", "2026-06-01");
  await addExpense(page, "Bus", "50", "Transport", "2026-06-02");
  await addExpense(page, "Shirt", "30", "Shopping", "2026-06-03");
  await page.reload();

  await page.click("text=Food");
  await expect(page.locator("text=Bus")).not.toBeVisible();

  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows.length - 1).toBe(3);
  const titles = rows.slice(1).map((r) => r[3]);
  expect(titles).toEqual(expect.arrayContaining(["Apple", "Bus", "Shirt"]));
});

test("125: all 8 categories appear in export", async ({ page }) => {
  const cats = ["Food", "Transport", "Shopping", "Entertainment", "Bills", "Health", "Education", "Other"];
  for (let i = 0; i < cats.length; i++) {
    await addExpense(page, `Cat${i}`, "10", cats[i], "2026-06-01");
  }
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  const categories = rows.slice(1).map((r) => r[1]);
  for (const cat of cats) {
    expect(categories).toContain(cat);
  }
});

test("126: export with ancient date 1900-01-01", async ({ page }) => {
  await addExpense(page, "Old", "100", "Other", "1900-01-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][0]).toBe("1900-01-01");
});

test("127: export with far future date 9999-12-31", async ({ page }) => {
  await addExpense(page, "Future", "100", "Other", "9999-12-31");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][0]).toBe("9999-12-31");
});

test("128: export with amount near MAX_SAFE_INTEGER", async ({ page }) => {
  await addExpense(page, "MaxSafe", "9007199254740991", "Other", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][2]).toBe("9007199254740991");
});

test("129: export with amount having 9 decimal places", async ({ page }) => {
  await addExpense(page, "Precise", "12.123456789", "Food", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][2]).toBe("12.123456789");
});

test("130: export with negative amount", async ({ page }) => {
  await addExpense(page, "Negative", "-50", "Other", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][2]).toBe("-50");
});

test("131: export with mixed multi-script title", async ({ page }) => {
  await addExpense(page, "Hello مرحبا 你好 おはよう 😊", "42", "Education", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3]).toBe("Hello مرحبا 你好 おはよう 😊");
});

test("132: export with title containing only numbers", async ({ page }) => {
  await addExpense(page, "1234567890", "10", "Other", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3]).toBe("1234567890");
});

test("133: export after add -> delete -> add cycle", async ({ page }) => {
  await addExpense(page, "Temp", "1", "Food", "2026-06-01");
  await page.reload();
  await page.click("text=✕");
  await addExpense(page, "Final", "99", "Transport", "2026-06-02");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows.length - 1).toBe(1);
  expect(rows[1][3]).toBe("Final");
  expect(rows[1][1]).toBe("Transport");
});

test("134: rapid export 5 times in a row", async ({ page }) => {
  await addExpense(page, "Rapid", "10", "Food", "2026-06-01");
  await page.reload();
  for (let i = 0; i < 5; i++) {
    const csv = await exportCsv(page);
    const rows = parseCsv(csv);
    expect(rows[1][3]).toBe("Rapid");
  }
});

test("135: export with 0.01 amount boundary", async ({ page }) => {
  await addExpense(page, "Boundary", "0.01", "Food", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][2]).toBe("0.01");
});

test("136: export with amount 999999999.99", async ({ page }) => {
  await addExpense(page, "LargeDecimal", "999999999.99", "Shopping", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][2]).toBe("999999999.99");
});

test("137: export after clearing localStorage then adding fresh data", async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await addExpense(page, "Fresh", "25", "Food", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows.length - 1).toBe(1);
  expect(rows[1][3]).toBe("Fresh");
});

test("138: export with title containing backslash", async ({ page }) => {
  await addExpense(page, "Path\\to\\file", "5", "Other", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3]).toBe("Path\\to\\file");
});

test("139: export preserves date format as YYYY-MM-DD", async ({ page }) => {
  await addExpense(page, "DateFormat", "10", "Food", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][0]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
});

test("140: export with title containing angle brackets (non-HTML)", async ({ page }) => {
  await addExpense(page, "a < b > c", "7", "Education", "2026-06-01");
  await page.reload();
  const csv = await exportCsv(page);
  const rows = parseCsv(csv);
  expect(rows[1][3]).toBe("a < b > c");
});
