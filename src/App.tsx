import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  Plus,
  Search,
  Settings2,
  Trash2,
  Wallet,
} from "lucide-react";
import {
  createTransaction,
  listTransactions,
  removeTransaction,
  type Transaction,
  type TransactionKind,
} from "./db";

const expenseCategories = ["Moradia", "Alimentação", "Transporte", "Saúde", "Lazer", "Educação", "Outros"];
const incomeCategories = ["Salário", "Freelance", "Investimentos", "Presente", "Outros"];

function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function currentDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);
}

function formatDate(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric" })
    .format(new Date(year, month - 1, day));
}

function formatMonth(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(year, number - 1, 1));
}

function App() {
  const [month, setMonth] = useState(currentMonth);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [kindFilter, setKindFilter] = useState<"all" | TransactionKind>("all");
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState(expenseCategories[0]);
  const [date, setDate] = useState(currentDate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setTransactions(await listTransactions(month));
    } catch (cause) {
      setError(`Não foi possível acessar o banco de dados local. ${String(cause)}`);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filteredTransactions = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return transactions.filter((transaction) => {
      const matchesKind = kindFilter === "all" || transaction.kind === kindFilter;
      const matchesSearch = !query
        || transaction.description.toLocaleLowerCase("pt-BR").includes(query)
        || transaction.category.toLocaleLowerCase("pt-BR").includes(query);
      return matchesKind && matchesSearch;
    });
  }, [transactions, kindFilter, search]);

  const totals = useMemo(() => {
    return transactions.reduce((result, transaction) => {
      result[transaction.kind] += transaction.amount;
      return result;
    }, { income: 0, expense: 0 });
  }, [transactions]);

  const expensesByCategory = useMemo(() => {
    const totalsByCategory = new Map<string, number>();
    for (const transaction of transactions) {
      if (transaction.kind === "expense") {
        totalsByCategory.set(
          transaction.category,
          (totalsByCategory.get(transaction.category) ?? 0) + transaction.amount,
        );
      }
    }
    return [...totalsByCategory.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [transactions]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amountInCents = Math.round(Number(amount.replace(",", ".")) * 100);
    if (!description.trim() || !Number.isSafeInteger(amountInCents) || amountInCents <= 0 || !date) {
      setError("Preencha a descrição, um valor válido e a data do lançamento.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await createTransaction({
        description: description.trim(),
        amount: amountInCents,
        kind,
        category,
        date,
      });
      setDescription("");
      setAmount("");
      setFormOpen(false);
      if (date.slice(0, 7) === month) {
        await refresh();
      } else {
        setMonth(date.slice(0, 7));
      }
    } catch (cause) {
      setError(`Não foi possível salvar o lançamento. ${String(cause)}`);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(transaction: Transaction) {
    if (!window.confirm(`Excluir o lançamento "${transaction.description}"?`)) return;
    setError("");
    try {
      await removeTransaction(transaction.id);
      await refresh();
    } catch (cause) {
      setError(`Não foi possível excluir o lançamento. ${String(cause)}`);
    }
  }

  function changeKind(nextKind: TransactionKind) {
    setKind(nextKind);
    setCategory(nextKind === "expense" ? expenseCategories[0] : incomeCategories[0]);
  }

  const maxCategoryAmount = expensesByCategory[0]?.[1] ?? 1;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Minhas finanças, início">
          <span className="brand-mark"><ChartNoAxesCombined size={21} strokeWidth={2.5} /></span>
          <span>finanças<span className="brand-dot">.</span></span>
        </a>
        <div className="workspace-label">ESPAÇO PESSOAL</div>
        <nav className="main-nav" aria-label="Navegação principal">
          <a className="nav-item active" href="#dashboard"><LayoutDashboard size={18} /> Visão geral</a>
          <a className="nav-item" href="#transacoes"><Wallet size={18} /> Lançamentos</a>
          <a className="nav-item" href="#categorias"><ChartNoAxesCombined size={18} /> Categorias</a>
        </nav>
        <div className="sidebar-bottom">
          <div className="local-note">
            <span className="local-note-icon"><CircleHelp size={17} /></span>
            <div><strong>Seus dados, no seu PC</strong><p>Salvos localmente em um banco SQLite.</p></div>
          </div>
          <button className="profile-button" type="button">
            <span className="avatar">L</span>
            <span className="profile-copy"><strong>Meu espaço</strong><small>Uso pessoal</small></span>
            <Settings2 size={17} className="profile-settings" />
          </button>
        </div>
      </aside>

      <main className="main-content" id="dashboard">
        <header className="topbar">
          <div className="breadcrumb">Painel <span>/</span> <strong>Visão geral</strong></div>
          <div className="topbar-actions">
            <label className="month-picker">
              <CalendarDays size={16} />
              <input aria-label="Mês dos lançamentos" type="month" value={month} onChange={(event) => setMonth(event.target.value || currentMonth())} />
              <ChevronDown size={14} className="month-chevron" />
            </label>
            <button className="primary-button" onClick={() => setFormOpen((open) => !open)} type="button">
              <Plus size={17} /> Novo lançamento
            </button>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">SEU RESUMO FINANCEIRO</p>
              <h1>Visão geral</h1>
              <p className="subtitle">Acompanhe de perto a saúde das suas finanças.</p>
            </div>
            <span className="period-label">{formatMonth(month)}</span>
          </section>

          {error && <div className="error-banner" role="alert">{error}</div>}

          {formOpen && (
            <section className="form-card" aria-labelledby="form-title">
              <div className="form-heading">
                <div><p className="eyebrow">NOVO REGISTRO</p><h2 id="form-title">Adicionar lançamento</h2></div>
                <button className="text-button" type="button" onClick={() => setFormOpen(false)}>Cancelar</button>
              </div>
              <form className="transaction-form" onSubmit={(event) => void handleSubmit(event)}>
                <div className="kind-switch" role="group" aria-label="Tipo de lançamento">
                  <button className={kind === "expense" ? "selected expense-choice" : ""} type="button" onClick={() => changeKind("expense")}><ArrowUpRight size={16} /> Despesa</button>
                  <button className={kind === "income" ? "selected income-choice" : ""} type="button" onClick={() => changeKind("income")}><ArrowDownLeft size={16} /> Entrada</button>
                </div>
                <label className="field"><span>Descrição</span><input autoFocus required maxLength={100} placeholder="Ex.: Conta de luz" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                <label className="field"><span>Valor (R$)</span><input required inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                <label className="field"><span>Categoria</span><select value={category} onChange={(event) => setCategory(event.target.value)}>{(kind === "expense" ? expenseCategories : incomeCategories).map((item) => <option key={item}>{item}</option>)}</select></label>
                <label className="field"><span>Data</span><input required type="date" value={date} onChange={(event) => setDate(event.target.value)} /></label>
                <div className="form-submit"><button className="primary-button" type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar lançamento"}</button></div>
              </form>
            </section>
          )}

          <section className="metric-grid" aria-label="Resumo do mês">
            <article className="metric-card balance-card">
              <div className="metric-top"><span className="metric-label">Saldo do período</span><span className="metric-icon balance-icon"><Wallet size={19} /></span></div>
              <strong className="metric-value">{formatCurrency(totals.income - totals.expense)}</strong>
              <span className="metric-footnote">Entradas menos saídas em {formatMonth(month)}</span>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-label">Total de entradas</span><span className="metric-icon income-icon"><ArrowDownLeft size={19} /></span></div>
              <strong className="metric-value">{formatCurrency(totals.income)}</strong>
              <span className="metric-footnote">Dinheiro que entrou no período</span>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-label">Total de saídas</span><span className="metric-icon expense-icon"><ArrowUpRight size={19} /></span></div>
              <strong className="metric-value">{formatCurrency(totals.expense)}</strong>
              <span className="metric-footnote">Dinheiro que saiu no período</span>
            </article>
            <article className="metric-card">
              <div className="metric-top"><span className="metric-label">Lançamentos</span><span className="metric-icon count-icon"><ChartNoAxesCombined size={19} /></span></div>
              <strong className="metric-value">{transactions.length}</strong>
              <span className="metric-footnote">Registros neste período</span>
            </article>
          </section>

          <section className="insights-grid">
            <article className="panel category-panel" id="categorias">
              <div className="panel-heading">
                <div><h2>Despesas por categoria</h2><p>Onde você mais gastou neste período</p></div>
                <span className="panel-menu" aria-hidden="true">···</span>
              </div>
              {expensesByCategory.length ? (
                <div className="category-list">
                  {expensesByCategory.map(([name, value], index) => (
                    <div className="category-row" key={name}>
                      <div className="category-details"><span className={`category-dot category-color-${index}`} /><span>{name}</span><strong>{formatCurrency(value)}</strong></div>
                      <div className="bar-track"><span className={`bar-fill bar-color-${index}`} style={{ width: `${Math.max(4, (value / maxCategoryAmount) * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="empty-chart"><span className="empty-chart-icon"><ChartNoAxesCombined size={22} /></span><strong>Nenhuma despesa por aqui</strong><span>Os gastos do período aparecerão nesta área.</span></div>
              )}
            </article>
            <article className="panel period-panel">
              <div className="panel-heading"><div><h2>Resumo do período</h2><p>Comparativo de entradas e saídas</p></div></div>
              <div className="period-summary">
                <div className="summary-line"><span><i className="legend-dot income-legend" /> Entradas</span><strong>{formatCurrency(totals.income)}</strong></div>
                <div className="summary-line"><span><i className="legend-dot expense-legend" /> Saídas</span><strong>{formatCurrency(totals.expense)}</strong></div>
                <div className="comparison-track"><span className="comparison-income" style={{ width: `${totals.income + totals.expense ? (totals.income / (totals.income + totals.expense)) * 100 : 50}%` }} /><span className="comparison-expense" /></div>
                <div className="period-result"><span>Resultado</span><strong className={totals.income >= totals.expense ? "positive-value" : "negative-value"}>{formatCurrency(totals.income - totals.expense)}</strong></div>
              </div>
              <div className="period-tip"><span>✦</span> Se acompanhe seus lançamentos regularmente para manter tudo sob controle.</div>
            </article>
          </section>

          <section className="panel transactions-panel" id="transacoes">
            <div className="panel-heading transaction-heading">
              <div><h2>Lançamentos recentes</h2><p>Confira as movimentações de {formatMonth(month)}</p></div>
              <div className="table-actions">
                <label className="search-field"><Search size={16} /><input placeholder="Buscar lançamento" aria-label="Buscar lançamento" value={search} onChange={(event) => setSearch(event.target.value)} /></label>
                <select className="filter-select" aria-label="Filtrar por tipo" value={kindFilter} onChange={(event) => setKindFilter(event.target.value as "all" | TransactionKind)}>
                  <option value="all">Todos</option><option value="income">Entradas</option><option value="expense">Saídas</option>
                </select>
              </div>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>DESCRIÇÃO</th><th>CATEGORIA</th><th>DATA</th><th>TIPO</th><th className="amount-column">VALOR</th><th aria-label="Ações" /></tr></thead>
                <tbody>
                  {loading ? <tr><td className="table-message" colSpan={6}>Carregando lançamentos...</td></tr>
                    : filteredTransactions.length ? filteredTransactions.map((transaction) => (
                      <tr key={transaction.id}>
                        <td><span className="transaction-name">{transaction.description}</span></td>
                        <td><span className="category-pill">{transaction.category}</span></td>
                        <td className="date-cell">{formatDate(transaction.date)}</td>
                        <td><span className={`type-badge ${transaction.kind}`}><i />{transaction.kind === "income" ? "Entrada" : "Saída"}</span></td>
                        <td className={`amount-cell ${transaction.kind}`}>{transaction.kind === "income" ? "+" : "−"} {formatCurrency(transaction.amount)}</td>
                        <td><button className="delete-button" type="button" aria-label={`Excluir ${transaction.description}`} onClick={() => void handleDelete(transaction)}><Trash2 size={16} /></button></td>
                      </tr>
                    )) : <tr><td className="table-message" colSpan={6}>{search || kindFilter !== "all" ? "Nenhum lançamento corresponde a essa busca." : "Nenhum lançamento neste mês. Adicione uma entrada ou despesa para começar."}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="table-footer"><span>{filteredTransactions.length} {filteredTransactions.length === 1 ? "lançamento" : "lançamentos"}</span><span>Armazenado localmente no seu computador</span></div>
          </section>
          <footer className="page-footer">Finanças pessoais <span>•</span> Seus dados ficam neste computador</footer>
        </div>
      </main>
    </div>
  );
}

export default App;
