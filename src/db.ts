import Database from "@tauri-apps/plugin-sql";

export type TransactionKind = "income" | "expense";

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
      return database;
    }).catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }

  return databasePromise;
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
