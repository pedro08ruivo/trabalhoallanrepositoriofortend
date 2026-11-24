'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import publicApi, { logoutSession } from '@/lib/api';

type UserSummary = { id: number; name: string; username: string; email: string; isAdmin: boolean; active: boolean };
type NamedItem = { id: number; name: string; description?: string; nationality?: string };
type Category = NamedItem & { description?: string };
type Author = NamedItem & { nationality?: string; birthDate?: string };
type Book = { id: number; title: string; isbn: string; year?: number; totalCopies: number; availableCopies: number; categoryId: number; category?: Category; authors?: Author[] };
type Reader = { id: number; name: string; cpf: string; email?: string; phone?: string };
type Loan = { id: number; loanDate: string; dueDate: string; returnDate?: string; status: string; fine: number; book?: Book; reader?: Reader };
type Report = { totalBooks: number; activeLoans: number; overdueLoans: number; totalFines: number };

const styles: Record<string, React.CSSProperties> = {
  shell: { minHeight: '100vh', background: '#f3f5f7' },
  topbar: { height: 72, background: '#5C2034', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 32px' },
  layout: { display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: 'calc(100vh - 72px)' },
  nav: { background: 'white', borderRight: '1px solid #e4e4e4', padding: 16, display: 'flex', flexDirection: 'column', gap: 6 },
  content: { padding: 28, maxWidth: 1100, width: '100%', boxSizing: 'border-box' },
  card: { background: 'white', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18, boxShadow: '0 4px 18px rgba(0,0,0,.04)' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 },
  tableWrap: { overflowX: 'auto', marginTop: 18 },
  table: { width: '100%', borderCollapse: 'collapse', background: 'white' },
  th: { textAlign: 'left', background: '#f8f8f8', borderBottom: '1px solid #ddd', padding: 10 },
  td: { borderBottom: '1px solid #eee', padding: 10, verticalAlign: 'middle' },
  form: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, alignItems: 'end', marginBottom: 18 },
  input: { width: '100%', boxSizing: 'border-box', border: '1px solid #ccc', borderRadius: 7, padding: '9px 10px' },
};

export default function Dashboard() {
  const router = useRouter();
  const [tab, setTab] = useState('overview');
  const [me, setMe] = useState<UserSummary | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [authors, setAuthors] = useState<Author[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [readers, setReaders] = useState<Reader[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [users, setUsers] = useState<UserSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [accessSeconds, setAccessSeconds] = useState<number | null>(null);
  const [sessionMessage, setSessionMessage] = useState('');
  const accessExpiresAtRef = useRef<number>(0);
  const refreshAttemptRef = useRef(false);

  async function loadAll() {
    setError(null);
    try {
      const meResponse = await publicApi.get<UserSummary>('/auth/me');
      setMe(meResponse.data);

      const [categoryResponse, authorResponse, readerResponse, bookResponse, loanResponse] = await Promise.all([
        publicApi.get<Category[]>('/categories'),
        publicApi.get<Author[]>('/authors'),
        publicApi.get<Reader[]>('/readers'),
        publicApi.get<Book[]>('/books'),
        publicApi.get<Loan[]>('/loans'),
      ]);
      setCategories(categoryResponse.data);
      setAuthors(authorResponse.data);
      setReaders(readerResponse.data);
      setBooks(bookResponse.data);
      setLoans(loanResponse.data);

      if (meResponse.data.isAdmin) {
        const [reportResponse, userResponse] = await Promise.all([
          publicApi.get<Report>('/reports/dashboard'),
          publicApi.get<UserSummary[]>('/user'),
        ]);
        setReport(reportResponse.data);
        setUsers(userResponse.data);
      }
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || 'Não foi possível carregar os dados.');
    }
  }

  useEffect(() => { loadAll(); }, []);

  useEffect(() => {
    let secondsRemaining = 30;
    setAccessSeconds(secondsRemaining);

    const timer = window.setInterval(() => {
      secondsRemaining -= 1;
      setAccessSeconds(Math.max(0, secondsRemaining));

      if (secondsRemaining === 0 && !refreshAttemptRef.current) {
        refreshAttemptRef.current = true;
        fetch('/api/auth/refresh', { method: 'POST', cache: 'no-store' })
          .then(async (response) => {
            const body = await response.json();
            if (!response.ok) throw new Error(body.error || 'Não foi possível renovar a sessão.');

            secondsRemaining = 30;
            accessExpiresAtRef.current = Date.now() + 30 * 1000;
            setAccessSeconds(30);
            setSessionMessage('Sessão renovada — novo access token ativo');
            window.setTimeout(() => setSessionMessage(''), 4000);
            window.dispatchEvent(new CustomEvent('session-refreshed'));
          })
          .catch(() => {
            window.location.assign(new URL('/', window.location.href).toString());
          })
          .finally(() => {
            refreshAttemptRef.current = false;
          });
      }
    }, 1000);

    function handleSessionRefreshed() {
      secondsRemaining = 30;
      setAccessSeconds(30);
      setSessionMessage('Sessão renovada — novo access token ativo');
      window.setTimeout(() => setSessionMessage(''), 4000);
    }

    window.addEventListener('session-refreshed', handleSessionRefreshed);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('session-refreshed', handleSessionRefreshed);
    };
  }, []);

  async function handleLogout() {
    try { await logoutSession(); } finally { router.replace('/'); }
  }

  async function submit(endpoint: string, body: object, reload = true) {
    setError(null);
    try {
      await publicApi.post(endpoint, body);
      if (reload) await loadAll();
    } catch (requestError: any) {
      setError(requestError?.response?.data?.error || 'Não foi possível concluir a operação.');
    }
  }

  async function remove(endpoint: string) {
    if (!window.confirm('Confirmar exclusão?')) return;
    setError(null);
    try { await publicApi.delete(endpoint); await loadAll(); }
    catch (requestError: any) { setError(requestError?.response?.data?.error || 'Não foi possível excluir.'); }
  }

  const tabs = [
    ['overview', 'Visão geral'], ['categories', 'Categorias'], ['authors', 'Autores'],
    ['books', 'Livros'], ['readers', 'Leitores'], ['loans', 'Empréstimos'],
  ];
  if (me?.isAdmin) tabs.push(['users', 'Atendentes']);

  return (
    <main style={styles.shell}>
      <header style={styles.topbar}>
        <div><strong>Biblioteca</strong><div style={{ fontSize: 13, opacity: .85 }}>{me?.name || 'Carregando...'}</div></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {sessionMessage && <strong style={{ color: '#d9ffd9', fontSize: 13 }}>{sessionMessage}</strong>}
          <div style={{ textAlign: 'right', fontSize: 12 }}>
            <div>Access token</div>
            <strong>{accessSeconds === null ? 'Verificando...' : accessSeconds > 0 ? `${accessSeconds}s restantes` : 'Expirado — renovando'}</strong>
          </div>
          <button className="btn-unipar" onClick={handleLogout}>Sair</button>
        </div>
      </header>
      <div style={styles.layout}>
        <nav style={styles.nav}>
          {tabs.map(([key, label]) => (
            <button key={key} type="button" onClick={() => setTab(key)} style={{ border: 0, borderRadius: 7, padding: '10px 12px', textAlign: 'left', cursor: 'pointer', background: tab === key ? '#5C2034' : '#fff', color: tab === key ? '#fff' : '#333' }}>{label}</button>
          ))}
        </nav>
        <section style={styles.content}>
          {error && <p role="alert" style={{ color: 'crimson', background: '#fff', padding: 12, borderRadius: 8 }}>{error}</p>}

          {tab === 'overview' && (
            <>
              <h1>Painel geral</h1>
              {me?.isAdmin && report ? (
                <div style={styles.grid}>
                  <div style={styles.card}><strong>Total de livros</strong><h2>{report.totalBooks}</h2></div>
                  <div style={styles.card}><strong>Empréstimos ativos</strong><h2>{report.activeLoans}</h2></div>
                  <div style={styles.card}><strong>Empréstimos atrasados</strong><h2>{report.overdueLoans}</h2></div>
                  <div style={styles.card}><strong>Total de multas</strong><h2>R$ {Number(report.totalFines).toFixed(2)}</h2></div>
                </div>
              ) : <div style={styles.card}>Sessão ativa como atendente. Use os módulos para cadastrar leitores e controlar empréstimos.</div>}
              <div style={{ marginTop: 32, padding: 16, borderRadius: 8, background: 'white', border: '1px solid #e5e7eb', display: 'flex', alignItems: 'center', gap: 16 }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{ flexShrink: 0 }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.404 1.404A2.002 2.002 0 0116 21H8a2 2 0 01-2-2v-1.586A2 2 0 015.586 16L7 17h8zm-6-4V4a2 2 0 012-2h4a2 2 0 012 2v9m-6 4v2m0 0H9m3 0h3" /></svg>
                <div style={{ fontSize: 14, color: '#333' }}>
                  {accessSeconds !== null ? `Sessão ativa: ${accessSeconds} seg` : 'Verificando sessão...'}
                  {sessionMessage && <div style={{ marginTop: 4, fontSize: 12, color: '#4caf50' }}>{sessionMessage}</div>}
                </div>
              </div>
            </>
          )}

          {tab === 'categories' && me?.isAdmin && <CategoryPanel categories={categories} submit={submit} loadAll={loadAll} />}
          {tab === 'authors' && me?.isAdmin && <AuthorPanel authors={authors} submit={submit} loadAll={loadAll} />}
          {tab === 'books' && <BookPanel books={books} categories={categories} authors={authors} admin={!!me?.isAdmin} search={search} setSearch={setSearch} submit={submit} remove={remove} loadAll={loadAll} />}
          {tab === 'readers' && <ReaderPanel readers={readers} submit={submit} loadAll={loadAll} />}
          {tab === 'loans' && <LoanPanel loans={loans} books={books} readers={readers} status={status} setStatus={setStatus} submit={submit} loadAll={loadAll} setError={setError} setLoans={setLoans} />}
          {tab === 'users' && me?.isAdmin && <UserPanel users={users} submit={submit} loadAll={loadAll} />}
        </section>
      </div>
    </main>
  );
}

function CategoryPanel({ categories, submit, loadAll }: any) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleted, setDeleted] = useState<Category | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit('/categories', { name: form.get('name'), description: form.get('description') });
    event.currentTarget.reset();
  }

  function beginEdit(item: Category) {
    setEditingId(item.id);
    setName(item.name);
    setDescription(item.description || '');
  }

  async function saveEdit(item: Category) {
    setMessage(null);
    if (!name.trim()) {
      setMessage('O nome da categoria é obrigatório.');
      return;
    }
    try {
      await publicApi.patch(`/categories/${item.id}`, { name: name.trim(), description });
      setEditingId(null);
      setMessage('Categoria atualizada com sucesso.');
      await loadAll();
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Não foi possível editar a categoria.');
    }
  }

  async function deleteCategory(item: Category) {
    if (!window.confirm(`Excluir a categoria "${item.name}"?`)) return;
    setMessage(null);
    try {
      await publicApi.delete(`/categories/${item.id}`);
      setDeleted(item);
      setMessage('Categoria excluída.');
      await loadAll();
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Não foi possível excluir a categoria.');
    }
  }

  async function undoDelete() {
    if (!deleted) return;
    setMessage(null);
    try {
      await publicApi.post('/categories', { name: deleted.name, description: deleted.description || null });
      setDeleted(null);
      setMessage('Exclusão revertida com sucesso.');
      await loadAll();
    } catch (error: any) {
      setMessage(error?.response?.data?.error || 'Não foi possível reverter a exclusão.');
    }
  }

  return (
    <>
      <h1>Categorias</h1>
      {message && <p role="alert" style={{ color: message.includes('sucesso') || message.includes('revertida') || message.includes('excluída') || message.includes('atualizada') ? '#166534' : '#b91c1c' }}>{message}</p>}
      {deleted && <button type="button" className="btn-unipar" onClick={undoDelete}>Reverter exclusão: {deleted.name}</button>}
      <form style={styles.form} onSubmit={handleSubmit}>
        <label>Nome<input name="name" required style={styles.input}/></label>
        <label>Descrição<input name="description" style={styles.input}/></label>
        <button className="btn-unipar" type="submit">Cadastrar</button>
      </form>
      <Table headers={['Nome','Descrição','Ações']} rows={categories.map((item: Category) => [
        editingId === item.id
          ? <input key="name" value={name} onChange={(event) => setName(event.target.value)} style={styles.input}/>
          : item.name,
        editingId === item.id
          ? <input key="description" value={description} onChange={(event) => setDescription(event.target.value)} style={styles.input}/>
          : item.description || '-',
        editingId === item.id
          ? <span key="actions"><button type="button" onClick={() => saveEdit(item)}>Salvar</button>{' '}<button type="button" onClick={() => setEditingId(null)}>Cancelar</button></span>
          : <span key="actions"><button type="button" onClick={() => beginEdit(item)}>Editar</button>{' '}<button type="button" onClick={() => deleteCategory(item)}>Excluir</button></span>
      ])}/>
    </>
  );
}

function AuthorPanel({ authors, submit, loadAll }: any) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [nationality, setNationality] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [deleted, setDeleted] = useState<Author | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit('/authors', { name: form.get('name'), nationality: form.get('nationality'), birthDate: form.get('birthDate') || null });
    event.currentTarget.reset();
  }

  function beginEdit(item: Author) {
    setEditingId(item.id); setName(item.name); setNationality(item.nationality || ''); setBirthDate(item.birthDate || '');
  }

  async function saveEdit(item: Author) {
    setMessage(null);
    if (!name.trim()) { setMessage('O nome do autor é obrigatório.'); return; }
    try {
      await publicApi.patch(`/authors/${item.id}`, { name: name.trim(), nationality: nationality || null, birthDate: birthDate || null });
      setEditingId(null); setMessage('Autor atualizado com sucesso.'); await loadAll();
    } catch (error: any) { setMessage(error?.response?.data?.error || 'Não foi possível editar o autor.'); }
  }

  async function deleteAuthor(item: Author) {
    if (!window.confirm(`Excluir o autor "${item.name}"?`)) return;
    setMessage(null);
    try {
      await publicApi.delete(`/authors/${item.id}`);
      setDeleted(item); setMessage('Autor excluído.'); await loadAll();
    } catch (error: any) { setMessage(error?.response?.data?.error || 'Não foi possível excluir o autor.'); }
  }

  async function undoDelete() {
    if (!deleted) return;
    try {
      await publicApi.post('/authors', { name: deleted.name, nationality: deleted.nationality || null, birthDate: deleted.birthDate || null });
      setDeleted(null); setMessage('Exclusão revertida com sucesso.'); await loadAll();
    } catch (error: any) { setMessage(error?.response?.data?.error || 'Não foi possível reverter a exclusão.'); }
  }

  return (
    <>
      <h1>Autores</h1>
      {message && <p role="alert" style={{ color: message.includes('sucesso') || message.includes('revertida') || message.includes('excluída') || message.includes('atualizada') ? '#166534' : '#b91c1c' }}>{message}</p>}
      {deleted && <button type="button" className="btn-unipar" onClick={undoDelete}>Reverter exclusão: {deleted.name}</button>}
      <form style={styles.form} onSubmit={handleSubmit}>
        <label>Nome<input name="name" required style={styles.input}/></label>
        <label>Nacionalidade<input name="nationality" style={styles.input}/></label>
        <label>Nascimento<input name="birthDate" type="date" style={styles.input}/></label>
        <button className="btn-unipar" type="submit">Cadastrar</button>
      </form>
      <Table headers={['Nome','Nacionalidade','Nascimento','Ações']} rows={authors.map((item: Author) => [
        editingId === item.id ? <input key="name" value={name} onChange={(event) => setName(event.target.value)} style={styles.input}/> : item.name,
        editingId === item.id ? <input key="nationality" value={nationality} onChange={(event) => setNationality(event.target.value)} style={styles.input}/> : item.nationality || '-',
        editingId === item.id ? <input key="birthDate" type="date" value={birthDate} onChange={(event) => setBirthDate(event.target.value)} style={styles.input}/> : item.birthDate || '-',
        editingId === item.id
          ? <span key="actions"><button type="button" onClick={() => saveEdit(item)}>Salvar</button>{' '}<button type="button" onClick={() => setEditingId(null)}>Cancelar</button></span>
          : <span key="actions"><button type="button" onClick={() => beginEdit(item)}>Editar</button>{' '}<button type="button" onClick={() => deleteAuthor(item)}>Excluir</button></span>
      ])}/>
    </>
  );
}

function BookPanel({ books, categories, authors, admin, search, setSearch, submit, loadAll }: any) {
  const [categoryId, setCategoryId] = useState('');
  const [authorId, setAuthorId] = useState('');
  const [availableOnly, setAvailableOnly] = useState(false);
  const [filteredBooks, setFilteredBooks] = useState<Book[]>(books);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ title: '', isbn: '', year: '', totalCopies: '', categoryId: '', authorIds: [] as number[] });
  const [deleted, setDeleted] = useState<Book | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => { setFilteredBooks(books); }, [books]);

  async function applyFilters() {
    const params = new URLSearchParams();
    if (search) params.set('title', search);
    if (categoryId) params.set('categoryId', categoryId);
    if (authorId) params.set('authorId', authorId);
    if (availableOnly) params.set('available', 'true');
    try {
      const response = await publicApi.get<Book[]>(`/books${params.size ? `?${params.toString()}` : ''}`);
      setFilteredBooks(response.data);
    } catch (error: any) { setMessage(error?.response?.data?.error || 'Não foi possível filtrar os livros.'); }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit('/books', { title: form.get('title'), isbn: form.get('isbn'), year: form.get('year') ? Number(form.get('year')) : null, totalCopies: Number(form.get('totalCopies')), categoryId: Number(form.get('categoryId')), authorIds: form.getAll('authorIds').map(Number) });
    event.currentTarget.reset();
  }

  function beginEdit(book: Book) {
    setEditingId(book.id);
    setDraft({
      title: book.title,
      isbn: book.isbn,
      year: book.year ? String(book.year) : '',
      totalCopies: String(book.totalCopies),
      categoryId: String(book.categoryId),
      authorIds: book.authors?.map((author) => author.id) || []
    });
  }

  async function saveEdit(book: Book) {
    setMessage(null);
    if (!draft.title.trim() || !draft.isbn.trim()) { setMessage('Título e ISBN são obrigatórios.'); return; }
    try {
      await publicApi.patch(`/books/${book.id}`, {
        title: draft.title.trim(),
        isbn: draft.isbn.trim(),
        year: draft.year ? Number(draft.year) : null,
        totalCopies: Number(draft.totalCopies),
        categoryId: Number(draft.categoryId),
        authorIds: draft.authorIds
      });
      setEditingId(null); setMessage('Livro atualizado com sucesso.'); await loadAll(); await applyFilters();
    } catch (error: any) { setMessage(error?.response?.data?.error || 'Não foi possível editar o livro.'); }
  }

  async function deleteBook(book: Book) {
    if (!window.confirm(`Excluir o livro "${book.title}"?`)) return;
    setMessage(null);
    try {
      await publicApi.delete(`/books/${book.id}`);
      setDeleted(book); setMessage('Livro excluído.'); await loadAll(); await applyFilters();
    } catch (error: any) { setMessage(error?.response?.data?.error || 'Não foi possível excluir o livro.'); }
  }

  async function undoDelete() {
    if (!deleted) return;
    try {
      await publicApi.post('/books', {
        title: deleted.title,
        isbn: deleted.isbn,
        year: deleted.year || null,
        totalCopies: deleted.totalCopies,
        categoryId: deleted.categoryId,
        authorIds: deleted.authors?.map((author) => author.id) || []
      });
      setDeleted(null); setMessage('Exclusão revertida com sucesso.'); await loadAll(); await applyFilters();
    } catch (error: any) { setMessage(error?.response?.data?.error || 'Não foi possível reverter a exclusão.'); }
  }

  return (
    <>
      <h1>Livros</h1>
      {message && <p role="alert">{message}</p>}
      {deleted && <button type="button" onClick={undoDelete}>Reverter exclusão: {deleted.title}</button>}
      {admin && <form style={styles.form} onSubmit={handleSubmit}>
        <label>Título<input name="title" required style={styles.input}/></label>
        <label>ISBN<input name="isbn" required style={styles.input}/></label>
        <label>Ano<input name="year" type="number" style={styles.input}/></label>
        <label>Exemplares<input name="totalCopies" type="number" min="0" required style={styles.input}/></label>
        <label>Categoria<select name="categoryId" required style={styles.input}><option value="">Selecione</option>{categories.map((category: Category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Autores<select name="authorIds" multiple style={{...styles.input, minHeight: 78}}>{authors.map((author: Author) => <option key={author.id} value={author.id}>{author.name}</option>)}</select></label>
        <button className="btn-unipar" type="submit">Cadastrar</button>
      </form>}
      <div style={{...styles.form, alignItems: 'end', marginBottom: 0}}>
        <label>Buscar por título<input value={search} onChange={(event) => setSearch(event.target.value)} style={styles.input}/></label>
        <label>Categoria<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} style={styles.input}><option value="">Todas</option>{categories.map((category: Category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
        <label>Autor<select value={authorId} onChange={(event) => setAuthorId(event.target.value)} style={styles.input}><option value="">Todos</option>{authors.map((author: Author) => <option key={author.id} value={author.id}>{author.name}</option>)}</select></label>
        <label><input type="checkbox" checked={availableOnly} onChange={(event) => setAvailableOnly(event.target.checked)}/> Somente disponíveis</label>
        <button type="button" className="btn-unipar" onClick={applyFilters}>Filtrar</button>
      </div>
      <Table headers={['Título','ISBN','Ano','Categoria','Autores','Disponíveis','Ações']} rows={filteredBooks.map((book: Book) => [
        editingId === book.id ? <input key="title" value={draft.title} onChange={(event) => setDraft({...draft, title: event.target.value})} style={styles.input}/> : book.title,
        editingId === book.id ? <input key="isbn" value={draft.isbn} onChange={(event) => setDraft({...draft, isbn: event.target.value})} style={styles.input}/> : book.isbn,
        editingId === book.id ? <input key="year" type="number" value={draft.year} onChange={(event) => setDraft({...draft, year: event.target.value})} style={styles.input}/> : book.year || '-',
        editingId === book.id
          ? <select key="category" value={draft.categoryId} onChange={(event) => setDraft({...draft, categoryId: event.target.value})} style={styles.input}>{categories.map((category: Category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select>
          : book.category?.name || '-',
        editingId === book.id
          ? <select key="authors" multiple value={draft.authorIds.map(String)} onChange={(event) => setDraft({...draft, authorIds: Array.from(event.target.selectedOptions, (option) => Number(option.value))})} style={styles.input}>{authors.map((author: Author) => <option key={author.id} value={author.id}>{author.name}</option>)}</select>
          : book.authors?.map((item) => item.name).join(', ') || '-',
        `${book.availableCopies}/${book.totalCopies}`,
        admin ? (editingId === book.id
          ? <span key="actions"><button type="button" onClick={() => saveEdit(book)}>Salvar</button>{' '}<button type="button" onClick={() => setEditingId(null)}>Cancelar</button></span>
          : <span key="actions"><button type="button" onClick={() => beginEdit(book)}>Editar</button>{' '}<button type="button" onClick={() => deleteBook(book)}>Excluir</button></span>) : '-'
      ])}/>
    </>
  );
}

function ReaderPanel({ readers, submit, loadAll }: any) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState({ name: '', cpf: '', email: '', phone: '' });
  const [deleted, setDeleted] = useState<Reader | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    submit('/readers', { name: form.get('name'), cpf: form.get('cpf'), email: form.get('email') || null, phone: form.get('phone') || null });
    event.currentTarget.reset();
  }

  function beginEdit(reader: Reader) {
    setEditingId(reader.id);
    setDraft({ name: reader.name, cpf: reader.cpf, email: reader.email || '', phone: reader.phone || '' });
  }

  async function saveEdit(reader: Reader) {
    setMessage(null);
    if (!draft.name.trim() || !draft.cpf.trim()) { setMessage('Nome e CPF são obrigatórios.'); return; }
    try {
      await publicApi.patch(`/readers/${reader.id}`, { name: draft.name.trim(), cpf: draft.cpf.trim(), email: draft.email || null, phone: draft.phone || null });
      setEditingId(null); setMessage('Leitor atualizado com sucesso.'); await loadAll();
    } catch (error: any) { setMessage(error?.response?.data?.error || 'Não foi possível editar o leitor.'); }
  }

  async function deleteReader(reader: Reader) {
    if (!window.confirm(`Excluir o leitor "${reader.name}"?`)) return;
    setMessage(null);
    try {
      await publicApi.delete(`/readers/${reader.id}`);
      setDeleted(reader); setMessage('Leitor excluído.'); await loadAll();
    } catch (error: any) { setMessage(error?.response?.data?.error || 'Não foi possível excluir o leitor.'); }
  }

  async function undoDelete() {
    if (!deleted) return;
    try {
      await publicApi.post('/readers', { name: deleted.name, cpf: deleted.cpf, email: deleted.email || null, phone: deleted.phone || null });
      setDeleted(null); setMessage('Exclusão revertida com sucesso.'); await loadAll();
    } catch (error: any) { setMessage(error?.response?.data?.error || 'Não foi possível reverter a exclusão.'); }
  }

  async function history(id: number) {
    const response = await publicApi.get<Loan[]>(`/readers/${id}/loans`);
    alert(response.data.map((loan) => `${loan.book?.title}: ${loan.status} — multa R$ ${Number(loan.fine).toFixed(2)}`).join('\n') || 'Nenhum empréstimo.');
  }

  return (
    <>
      <h1>Leitores</h1>
      {message && <p role="alert" style={{ color: message.includes('sucesso') || message.includes('revertida') || message.includes('excluída') || message.includes('atualizada') ? '#166534' : '#b91c1c' }}>{message}</p>}
      {deleted && <button type="button" className="btn-unipar" onClick={undoDelete}>Reverter exclusão: {deleted.name}</button>}
      <form style={styles.form} onSubmit={handleSubmit}>
        <label>Nome<input name="name" required style={styles.input}/></label>
        <label>CPF<input name="cpf" required style={styles.input}/></label>
        <label>E-mail<input name="email" type="email" style={styles.input}/></label>
        <label>Telefone<input name="phone" style={styles.input}/></label>
        <button className="btn-unipar" type="submit">Cadastrar</button>
      </form>
      <Table headers={['Nome','CPF','E-mail','Telefone','Ações']} rows={readers.map((reader: Reader) => [
        editingId === reader.id ? <input key="name" value={draft.name} onChange={(event) => setDraft({...draft, name: event.target.value})} style={styles.input}/> : reader.name,
        editingId === reader.id ? <input key="cpf" value={draft.cpf} onChange={(event) => setDraft({...draft, cpf: event.target.value})} style={styles.input}/> : reader.cpf,
        editingId === reader.id ? <input key="email" value={draft.email} onChange={(event) => setDraft({...draft, email: event.target.value})} style={styles.input}/> : reader.email || '-',
        editingId === reader.id ? <input key="phone" value={draft.phone} onChange={(event) => setDraft({...draft, phone: event.target.value})} style={styles.input}/> : reader.phone || '-',
        editingId === reader.id
          ? <span key="actions"><button type="button" onClick={() => saveEdit(reader)}>Salvar</button>{' '}<button type="button" onClick={() => setEditingId(null)}>Cancelar</button></span>
          : <span key="actions"><button type="button" onClick={() => beginEdit(reader)}>Editar</button>{' '}<button type="button" onClick={() => history(reader.id)}>Histórico</button>{' '}<button type="button" onClick={() => deleteReader(reader)}>Excluir</button></span>
      ])}/>
    </>
  );
}

function LoanPanel({ loans, books, readers, status, setStatus, submit, loadAll, setError, setLoans }: any) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); submit('/loans', { bookId: Number(form.get('bookId')), readerId: Number(form.get('readerId')) }); event.currentTarget.reset(); }
  async function changeStatus(value: string) { setStatus(value); try { const response = await publicApi.get<Loan[]>(`/loans${value ? `?status=${value}` : ''}`); setLoans(response.data); } catch (error: any) { setError(error?.response?.data?.error || 'Não foi possível filtrar os empréstimos.'); } }
  async function returnLoan(id: number) { setError(null); try { await publicApi.patch(`/loans/${id}/return`); await loadAll(); } catch (error: any) { setError(error?.response?.data?.error || 'Não foi possível registrar a devolução.'); } }
  const shown = status ? loans.filter((loan: Loan) => loan.status === status) : loans;
  return <><h1>Empréstimos</h1><form style={styles.form} onSubmit={handleSubmit}><label>Livro<select name="bookId" required style={styles.input}><option value="">Selecione</option>{books.filter((book: Book) => book.availableCopies > 0).map((book: Book) => <option key={book.id} value={book.id}>{book.title} ({book.availableCopies})</option>)}</select></label><label>Leitor<select name="readerId" required style={styles.input}><option value="">Selecione</option>{readers.map((reader: Reader) => <option key={reader.id} value={reader.id}>{reader.name}</option>)}</select></label><button className="btn-unipar" type="submit">Novo empréstimo</button></form><label>Filtrar status<select value={status} onChange={(event) => changeStatus(event.target.value)} style={{...styles.input, maxWidth: 220}}><option value="">Todos</option><option value="ATIVO">Ativo</option><option value="ATRASADO">Atrasado</option><option value="DEVOLVIDO">Devolvido</option></select></label><Table headers={['Livro','Leitor','Emprestado','Entrega','Status','Multa','Ação']} rows={shown.map((loan: Loan) => [loan.book?.title||'-',loan.reader?.name||'-',loan.loanDate,loan.dueDate,loan.status,`R$ ${Number(loan.fine).toFixed(2)}`,loan.returnDate ? '-' : [<button key="r" onClick={() => returnLoan(loan.id)}>Devolver</button>]])}/></>;
}

function UserPanel({ users, submit, loadAll }: any) {
  function create(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); submit('/user', { name: form.get('name'), username: form.get('username'), email: form.get('email'), password: form.get('password'), isAdmin: false, active: true }); event.currentTarget.reset(); }
  async function toggle(user: UserSummary) { try { await publicApi.patch(`/user/${user.id}/active`, { active: !user.active }); await loadAll(); } catch {} }
  return <><h1>Atendentes</h1><form style={styles.form} onSubmit={create}><label>Nome<input name="name" required style={styles.input}/></label><label>Usuário<input name="username" required style={styles.input}/></label><label>E-mail<input name="email" type="email" required style={styles.input}/></label><label>Senha<input name="password" type="password" required style={styles.input}/></label><button className="btn-unipar" type="submit">Cadastrar</button></form><Table headers={['Nome','E-mail','Perfil','Situação','Ação']} rows={users.map((user: UserSummary) => [user.name,user.email,user.isAdmin?'Administrador':'Atendente',user.active?'Ativo':'Inativo',[<button key="a" disabled={user.isAdmin} onClick={() => toggle(user)}>{user.active?'Desativar':'Ativar'}</button>]])}/></>;
}

function Table({ headers, rows }: { headers: string[]; rows: React.ReactNode[][] }) {
  return <div style={styles.tableWrap}><table style={styles.table}><thead><tr>{headers.map((header) => <th key={header} style={styles.th}>{header}</th>)}</tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={rowIndex}>{row.map((cell, cellIndex) => <td key={cellIndex} style={styles.td}>{cell}</td>)}</tr>)}</tbody></table></div>;
}
