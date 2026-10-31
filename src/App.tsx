import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChartNoAxesCombined,
  ChevronDown,
  CircleHelp,
  LayoutDashboard,
  Moon,
  Plus,
  Pencil,
  Search,
  Settings,
  Sun,
  Tags,
  Trash2,
  Wallet,
  X,
} from "lucide-react";
import {
  createCategory,
  createTransaction,
  DEFAULT_CATEGORIES,
  getThemePreference,
  listCategories,
  listTransactions,
  removeCategory,
  removeTransaction,
  renameCategory,
  saveThemePreference,
  type Category,
  type Transaction,
  type TransactionKind,
  type ThemePreference,
} from "./db";

declare const __APP_VERSION__: string;

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
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [search, setSearch] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [kind, setKind] = useState<TransactionKind>("expense");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("Moradia");
  const [date, setDate] = useState(currentDate);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [theme, setTheme] = useState<ThemePreference>("light");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [categorySubmenuOpen, setCategorySubmenuOpen] = useState(false);
  const [categoryKind, setCategoryKind] = useState<TransactionKind>("expense");
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryDialog, setCategoryDialog] = useState<"manage" | "edit" | null>(null);
  const [categoryDialogError, setCategoryDialogError] = useState("");
  const [categoryDialogBusy, setCategoryDialogBusy] = useState(false);
  const [editingCategoryName, setEditingCategoryName] = useState("");
  const [editedCategoryName, setEditedCategoryName] = useState("");

  const categoriesForKind = useMemo(
    () => categories.filter((item) => item.kind === kind),
    [categories, kind],
  );
  const settingsCategories = useMemo(
    () => categories.filter((item) => item.kind === categoryKind),
    [categories, categoryKind],
  );
  const editableCategory = settingsCategories.find((item) => item.name === editingCategoryName);

  useEffect(() => {
    if (!categoryDialog) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !categoryDialogBusy) setCategoryDialog(null);
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [categoryDialog, categoryDialogBusy]);

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

  useEffect(() => {
    getThemePreference()
      .then((preference) => {
        if (preference) setTheme(preference);
      })
      .catch((cause: unknown) => {
        setError(`Não foi possível carregar a preferência de tema. ${String(cause)}`);
      });
  }, []);

  useEffect(() => {
    listCategories()
      .then(setCategories)
      .catch((cause: unknown) => {
        setError(`Não foi possível carregar as categorias. ${String(cause)}`);
      });
  }, []);

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
    if (!description.trim() || !Number.isSafeInteger(amountInCents) || amountInCents <= 0 || !date || !category) {
      setError("Preencha a descrição, um valor válido, uma categoria e a data do lançamento.");
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

  async function handleAddCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = categoryDraft.trim();
    if (!name) return;
    if (categories.some((item) => item.kind === categoryKind
      && item.name.toLocaleLowerCase("pt-BR") === name.toLocaleLowerCase("pt-BR"))) {
      setCategoryDialogError("Já existe uma categoria com esse nome para esse tipo de lançamento.");
      return;
    }

    setCategoryDialogError("");
    setCategoryDialogBusy(true);
    try {
      const newCategory = { name, kind: categoryKind };
      await createCategory(newCategory);
      setCategories((current) => [...current, newCategory].sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      setCategoryDraft("");
      if (kind === categoryKind && !categoriesForKind.some((item) => item.name === category)) {
        setCategory(name);
      }
    } catch (cause) {
      setCategoryDialogError(`Não foi possível adicionar a categoria. ${String(cause)}`);
    } finally {
      setCategoryDialogBusy(false);
    }
  }

  async function handleRemoveCategory(item: Category) {
    if (!window.confirm(
      `Remover a categoria "${item.name}"? Lançamentos antigos continuarão exibindo esse nome.`,
    )) return;

    setCategoryDialogError("");
    setCategoryDialogBusy(true);
    try {
      await removeCategory(item);
      const updatedCategories = categories.filter(
        (categoryItem) => categoryItem.kind !== item.kind || categoryItem.name !== item.name,
      );
      setCategories(updatedCategories);
      if (kind === item.kind && category === item.name) {
        setCategory(updatedCategories.find((categoryItem) => categoryItem.kind === kind)?.name ?? "");
      }
    } catch (cause) {
      setCategoryDialogError(`Não foi possível remover a categoria. ${String(cause)}`);
    } finally {
      setCategoryDialogBusy(false);
    }
  }

  function changeCategoryKind(nextKind: TransactionKind) {
    setCategoryKind(nextKind);
    setCategoryDraft("");
    const firstCategory = categories.find((item) => item.kind === nextKind);
    setEditingCategoryName(firstCategory?.name ?? "");
    setEditedCategoryName(firstCategory?.name ?? "");
  }

  function openCategoryDialog(dialog: "manage" | "edit") {
    setCategoryDialogError("");
    setCategoryDraft("");
    setCategoryKind("expense");
    const firstCategory = categories.find((item) => item.kind === "expense");
    setEditingCategoryName(firstCategory?.name ?? "");
    setEditedCategoryName(firstCategory?.name ?? "");
    setSettingsOpen(false);
    setCategorySubmenuOpen(false);
    setCategoryDialog(dialog);
  }

  async function handleEditCategory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const name = editedCategoryName.trim();
    if (!editableCategory || !name) return;
    if (name.toLocaleLowerCase("pt-BR") === editableCategory.name.toLocaleLowerCase("pt-BR")) {
      setCategoryDialogError("Informe um nome diferente para a categoria.");
      return;
    }

    setCategoryDialogError("");
    setCategoryDialogBusy(true);
    try {
      const previousName = editableCategory.name;
      const updatedCategory = { ...editableCategory, name };
      await renameCategory(editableCategory, name);
      setCategories((current) => current.map((item) => (
        item.kind === editableCategory.kind && item.name === previousName ? updatedCategory : item
      )).sort((a, b) => a.name.localeCompare(b.name, "pt-BR")));
      if (kind === updatedCategory.kind && category === previousName) setCategory(name);
      setEditingCategoryName(name);
      setEditedCategoryName(name);
      setCategoryDialog(null);
    } catch (cause) {
      setCategoryDialogError(`Não foi possível editar a categoria. ${String(cause)}`);
    } finally {
      setCategoryDialogBusy(false);
    }
  }

  function changeKind(nextKind: TransactionKind) {
    setKind(nextKind);
    setCategory(categories.find((item) => item.kind === nextKind)?.name ?? "");
  }

  async function toggleTheme() {
    const nextTheme: ThemePreference = theme === "light" ? "dark" : "light";
    setError("");
    try {
      await saveThemePreference(nextTheme);
      setTheme(nextTheme);
    } catch (cause) {
      setError(`Não foi possível salvar a preferência de tema. ${String(cause)}`);
    }
  }

  const maxCategoryAmount = expensesByCategory[0]?.[1] ?? 1;

  return (
    <div className="app-shell" data-theme={theme}>
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
          <section className={`settings-menu${settingsOpen ? " open" : ""}`}>
            <button
              className="settings-trigger"
              type="button"
              aria-expanded={settingsOpen}
              aria-controls="settings-options"
              onClick={() => {
                setSettingsOpen((open) => {
                  if (open) setCategorySubmenuOpen(false);
                  return !open;
                });
              }}
            >
              <Settings size={17} />
              <span>Configurações</span>
              <ChevronDown size={15} className="settings-chevron" />
            </button>
            <div className={`settings-collapse${settingsOpen ? " open" : ""}`} id="settings-options" aria-hidden={!settingsOpen}>
              <div className="settings-options">
                <div className="theme-setting">
                  <div className="theme-setting-copy">
                    <span className="theme-current-icon" aria-hidden="true">
                      {theme === "dark" ? <Moon size={16} /> : <Sun size={16} />}
                    </span>
                    <span className="theme-setting-label">
                      <strong>{theme === "dark" ? "Modo escuro" : "Modo claro"}</strong>
                      <small>Tema atual</small>
                    </span>
                  </div>
                  <button
                    className="theme-switch"
                    type="button"
                    role="switch"
                    aria-checked={theme === "dark"}
                    aria-label="Modo escuro"
                    tabIndex={settingsOpen ? 0 : -1}
                    onClick={() => void toggleTheme()}
                  >
                    <span className="theme-switch-thumb">
                      {theme === "dark" ? <Moon size={12} /> : <Sun size={12} />}
                    </span>
                  </button>
                </div>
                <button
                  className="category-folder-trigger"
                  type="button"
                  aria-expanded={categorySubmenuOpen}
                  aria-controls="category-submenu"
                  tabIndex={settingsOpen ? 0 : -1}
                  onClick={() => setCategorySubmenuOpen((open) => !open)}
                >
                  <Tags size={16} />
                  <span>Categorias</span>
                  <ChevronDown size={14} className="category-folder-chevron" />
                </button>
                <div
                  className={`category-submenu-collapse${categorySubmenuOpen ? " open" : ""}`}
                  id="category-submenu"
                  aria-hidden={!categorySubmenuOpen}
                >
                  <div className="category-submenu">
                    <button className="category-submenu-item" type="button" tabIndex={categorySubmenuOpen ? 0 : -1} onClick={() => openCategoryDialog("manage")}>
                      <svg className="category-manage-icons" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M5 3.5v6M2 6.5h6M5 20.5 20.5 5M15.5 19h6" />
                      </svg>
                      <span>Adicionar/remover categorias</span>
                      <ChevronDown size={13} className="submenu-item-chevron" />
                    </button>
                    <button className="category-submenu-item" type="button" tabIndex={categorySubmenuOpen ? 0 : -1} onClick={() => openCategoryDialog("edit")}>
                      <Pencil size={15} />
                      <span>Editar categorias</span>
                      <ChevronDown size={13} className="submenu-item-chevron" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
          <button className="profile-button" type="button">
            <span className="avatar">L</span>
            <span className="profile-copy"><strong>Meu espaço</strong><small>Uso pessoal</small></span>
            <Settings size={17} className="profile-settings" />
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
                  <button className={kind === "expense" ? "selected expense-choice" : ""} type="button" aria-pressed={kind === "expense"} onClick={() => changeKind("expense")}><ArrowUpRight size={16} /> Despesa</button>
                  <button className={kind === "income" ? "selected income-choice" : ""} type="button" aria-pressed={kind === "income"} onClick={() => changeKind("income")}><ArrowDownLeft size={16} /> Entrada</button>
                </div>
                <label className="field"><span>Descrição</span><input autoFocus required maxLength={100} placeholder="Ex.: Conta de luz" value={description} onChange={(event) => setDescription(event.target.value)} /></label>
                <label className="field"><span>Valor (R$)</span><input required inputMode="decimal" placeholder="0,00" value={amount} onChange={(event) => setAmount(event.target.value)} /></label>
                <label className="field"><span>Categoria</span><select required value={category} onChange={(event) => setCategory(event.target.value)}>{categoriesForKind.length ? categoriesForKind.map((item) => <option key={item.name} value={item.name}>{item.name}</option>) : <option value="">Adicione uma categoria em Configurações</option>}</select></label>
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
        <span className="app-version" aria-label={`Versão ${__APP_VERSION__}`}>v{__APP_VERSION__}</span>
      </main>
      {categoryDialog && (
        <div
          className="dialog-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !categoryDialogBusy) setCategoryDialog(null);
          }}
        >
          <section
            className="category-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="category-dialog-title"
          >
            <header className="category-dialog-header">
              <div>
                <p className="dialog-eyebrow">CONFIGURAÇÕES / CATEGORIAS</p>
                <h2 id="category-dialog-title">
                  {categoryDialog === "manage" ? "Adicionar/remover categorias" : "Editar categoria"}
                </h2>
                <p>{categoryDialog === "manage"
                  ? "Organize as categorias disponíveis nos lançamentos."
                  : "Renomeie uma categoria usada nos próximos lançamentos."}</p>
              </div>
              <button className="dialog-close" type="button" aria-label="Fechar janela" disabled={categoryDialogBusy} onClick={() => setCategoryDialog(null)}>
                <X size={19} />
              </button>
            </header>
            <div className="category-dialog-body">
              {categoryDialogError && <div className="dialog-error" role="alert">{categoryDialogError}</div>}
              <div className="category-dialog-type-switch" role="group" aria-label="Tipo de categoria">
                <button
                  type="button"
                  className={categoryKind === "expense" ? "selected expense-choice" : ""}
                  aria-pressed={categoryKind === "expense"}
                  disabled={categoryDialogBusy}
                  onClick={() => changeCategoryKind("expense")}
                >Despesas</button>
                <button
                  type="button"
                  className={categoryKind === "income" ? "selected income-choice" : ""}
                  aria-pressed={categoryKind === "income"}
                  disabled={categoryDialogBusy}
                  onClick={() => changeCategoryKind("income")}
                >Entradas</button>
              </div>
              {categoryDialog === "manage" ? (
                <>
                  <form className="dialog-add-form" onSubmit={(event) => void handleAddCategory(event)}>
                    <label className="dialog-field">
                      <span>Nova categoria de {categoryKind === "expense" ? "despesa" : "entrada"}</span>
                      <input
                        autoFocus
                        aria-label="Nome da nova categoria"
                        maxLength={40}
                        placeholder="Ex.: Assinaturas"
                        value={categoryDraft}
                        onChange={(event) => setCategoryDraft(event.target.value)}
                      />
                    </label>
                    <button className="dialog-primary-button" type="submit" disabled={categoryDialogBusy || !categoryDraft.trim()}>
                      <Plus size={16} /> Adicionar
                    </button>
                  </form>
                  <div className="dialog-list-heading">
                    <h3>Categorias de {categoryKind === "expense" ? "despesa" : "entrada"}</h3>
                    <span>{settingsCategories.length}</span>
                  </div>
                  <ul className="dialog-category-list">
                    {settingsCategories.map((item) => (
                      <li key={`${item.kind}-${item.name}`}>
                        <span className={`dialog-category-dot ${item.kind}`} />
                        <span className="dialog-category-name">{item.name}</span>
                        <button
                          className="dialog-icon-button danger"
                          type="button"
                          aria-label={`Remover categoria ${item.name}`}
                          title={settingsCategories.length === 1 ? "Mantenha ao menos uma categoria" : "Remover categoria"}
                          disabled={categoryDialogBusy || settingsCategories.length === 1}
                          onClick={() => void handleRemoveCategory(item)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </li>
                    ))}
                  </ul>
                  <p className="dialog-note">Lançamentos antigos continuam exibindo a categoria original.</p>
                </>
              ) : (
                <form className="dialog-edit-form" onSubmit={(event) => void handleEditCategory(event)}>
                  <label className="dialog-field">
                    <span>Categoria</span>
                    <select
                      value={editingCategoryName}
                      disabled={categoryDialogBusy}
                      onChange={(event) => {
                        setEditingCategoryName(event.target.value);
                        setEditedCategoryName(event.target.value);
                        setCategoryDialogError("");
                      }}
                    >
                      {settingsCategories.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                    </select>
                  </label>
                  <label className="dialog-field">
                    <span>Novo nome</span>
                    <input
                      autoFocus
                      maxLength={40}
                      placeholder="Digite o novo nome"
                      disabled={categoryDialogBusy}
                      value={editedCategoryName}
                      onChange={(event) => setEditedCategoryName(event.target.value)}
                    />
                  </label>
                  <p className="dialog-note">A alteração vale para novos lançamentos; registros antigos preservam o nome usado na época.</p>
                  <footer className="category-dialog-footer">
                    <button className="dialog-secondary-button" type="button" disabled={categoryDialogBusy} onClick={() => setCategoryDialog(null)}>Cancelar</button>
                    <button className="dialog-primary-button" type="submit" disabled={categoryDialogBusy || !editableCategory || !editedCategoryName.trim()}>
                      <Pencil size={15} /> {categoryDialogBusy ? "Salvando..." : "Salvar alterações"}
                    </button>
                  </footer>
                </form>
              )}
            </div>
            {categoryDialog === "manage" && (
              <footer className="category-dialog-footer">
                <button className="dialog-secondary-button" type="button" disabled={categoryDialogBusy} onClick={() => setCategoryDialog(null)}>Fechar</button>
              </footer>
            )}
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
