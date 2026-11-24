'use client';

import { login } from '@/actions/login';
import { useActionState } from 'react';

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(login, { error: null });
  const { error } = state;

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: 20, boxSizing: 'border-box', background: 'linear-gradient(145deg, #f8f5f6, #eceeef)' }}>
      <section style={{ width: '100%', maxWidth: 420, background: 'white', padding: 32, borderRadius: 16, boxSizing: 'border-box', boxShadow: '0 18px 50px rgba(92,32,52,.14)', borderTop: '5px solid #C22820' }}>
        <p style={{ margin: 0, color: '#C22820', fontWeight: 700 }}>Sistema de Biblioteca</p>
        <h1 style={{ marginTop: 8 }}>Entrar na plataforma</h1>

        <form action={formAction} style={{ display: 'grid', gap: 14 }}>
          <label htmlFor="email">E-mail<input id="email" name="email" type="email" required style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 11, borderRadius: 8, border: '1px solid #bbb' }}/></label>
          <label htmlFor="password">Senha<input id="password" name="password" type="password" required style={{ width: '100%', boxSizing: 'border-box', marginTop: 6, padding: 11, borderRadius: 8, border: '1px solid #bbb' }}/></label>
          <button className="btn-unipar" disabled={isPending} type="submit">{isPending ? 'Entrando...' : 'Entrar'}</button>
          {error && <p role="alert" style={{ color: '#b91c1c', background: '#fff1f2', padding: 10, borderRadius: 8, margin: 0 }}>{error}</p>}
        </form>
      </section>
    </main>
  );
}