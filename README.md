# Plataforma SMM Pro

Sistema pronto para vender serviços SMM com saldo interno, pedidos, painel admin, margem de lucro, revendedores e integração com fornecedor SMM via API.

## Como rodar local

```bash
npm install
cp .env.example .env
npm start
```

Acesse: http://localhost:3000

Admin padrão vem do `.env`:
- Email: `ADMIN_EMAIL`
- Senha: `ADMIN_PASSWORD`

## Importante

1. Gere uma nova API key no fornecedor antes de subir online.
2. Nunca coloque a chave da API no frontend.
3. Configure Pix real e confirme depósitos no painel admin.
4. Use apenas serviços permitidos pelas plataformas e pelas leis locais.

## Subir online

Funciona bem em Render, Railway ou VPS. Para Vercel puro não é o ideal porque usa SQLite local.

