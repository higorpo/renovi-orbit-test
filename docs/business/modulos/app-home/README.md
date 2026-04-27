# Página inicial da aplicação (`app-home`)

## 1. Leitura para negócio

- **Para que serve:** rota raiz **`/`** da SPA após carregar o app; hoje é uma **tela mínima** de transição para login.
- **Quem usa:** qualquer visitante que acesse a origem do site.
- **Contexto:** não integra menu do dashboard nem guards de papel; está sob `RootLayout` como rota `index`.

## 2. Features do módulo

| Feature | Documento |
|---------|-----------|
| Página inicial | [features/pagina-inicial.md](./features/pagina-inicial.md) |

## 3. Evidências

- `src/App.tsx`
- `src/router.tsx` (`index: true` → `<App />`)
