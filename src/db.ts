import Database from "@tauri-apps/plugin-sql";

export type TransactionKind = "income" | "expense";
export type ThemePreference = "light" | "dark";

export interface Transaction {
  id: number;
  description: string;
  amount: number;
  kind: TransactionKind;
  category: string;
  date: string;
}

export interface NewTransaction {
  description: string;
  amount: number;
  kind: TransactionKind;
  category: string;
  date: string;
}

let databasePromise: Promise<Database> | undefined;

async function getDatabase(): Promise<Database> {
  if (!databasePromise) {
    databasePromise = Database.load("sqlite:financas.db").then(async (database) => {
      await database.execute(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          description TEXT NOT NULL,
          amount INTEGER NOT NULL CHECK (amount > 0),
          kind TEXT NOT NULL CHECK (kind IN ('income', 'expense')),
          category TEXT NOT NULL,
          date TEXT NOT NULL
        )
      `);
      await database.execute(`
        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        )
      `);
      return database;
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
}

export async function getThemePreference(): Promise<ThemePreference | null> {
  const database = await getDatabase();
  const rows = await database.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = $1",
    ["theme"],
  );
  const preference = rows[0]?.value;
  return preference === "light" || preference === "dark" ? preference : null;
}

export async function saveThemePreference(theme: ThemePreference): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    `INSERT INTO settings (key, value) VALUES ($1, $2)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ["theme", theme],
  );
}

export async function listTransactions(month: string): Promise<Transaction[]> {
  const database = await getDatabase();
  return database.select<Transaction[]>(
    `SELECT id, description, amount, kind, category, date
     FROM transactions
     WHERE date LIKE $1
     ORDER BY date DESC, id DESC`,
    [`${month}%`],
  );
}

export async function createTransaction(transaction: NewTransaction): Promise<void> {
  const database = await getDatabase();
  await database.execute(
    `INSERT INTO transactions (description, amount, kind, category, date)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      transaction.description,
      transaction.amount,
      transaction.kind,
      transaction.category,
      transaction.date,
    ],
  );
}

export async function removeTransaction(id: number): Promise<void> {
  const database = await getDatabase();
  await database.execute("DELETE FROM transactions WHERE id = $1", [id]);
}
