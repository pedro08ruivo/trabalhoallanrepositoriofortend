# jwt-app – Front-end da Biblioteca

## Vídeo de demonstração

**[▶ Assistir ao vídeo no YouTube](https://youtu.be/NTQZEUHGwF4)**

Aplicação Next.js responsável pelo login e pela interface de gestão da biblioteca.

## Pré-requisitos

- Node.js 20 ou superior
- API disponível em `http://localhost:3000`

## Instalação

```bash
npm install
npm run dev
```

Acesse `http://localhost:3001`.

## Configuração opcional

Para apontar o backend-for-frontend para outra URL da API, crie um `.env.local`:

```env
API_URL=http://localhost:3000/v1
```

Não coloque tokens ou senhas nesta variável pública.

## Funcionalidades

- Login com cookies `HttpOnly` e `SameSite=Lax`.
- Rotas protegidas no `proxy.ts`.
- Renovação automática de access token por interceptor Axios.
- Uma única chamada de refresh para respostas 401 simultâneas.
- Logout que revoga os tokens na API e apaga os cookies.
- Dashboard administrativo.
- Categorias, autores e livros.
- Leitores e histórico de empréstimos.
- Empréstimos, devoluções e multas.
- Cadastro e ativação/desativação de atendentes pelo administrador.

## Segurança dos tokens

Os tokens são mantidos em cookies `HttpOnly`, portanto JavaScript não pode lê-los. A desvantagem é que o navegador continuará enviando cookies em requisições elegíveis, exigindo HTTPS, `SameSite` adequado e proteção contra CSRF em produção. O acesso às operações também continua protegido pela API; ocultar um menu no front não substitui o middleware `isAdmin`.

## Usuário de teste

Quando o banco da API está vazio, o seed cria:

- E-mail: `admin@biblioteca.com`
- Senha: `123456`

A aplicação foi atualizada para Next.js `16.4.6` e pode ser iniciada com:

```bash
npm install
npm run dev -- --port 3001
```

## Logout e sessão inválida

O fluxo de logout revoga o refresh token atual e coloca o access token atual na blacklist. Quando a renovação falha, os cookies são removidos e o usuário é redirecionado para o login.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
