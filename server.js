const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

const SMM_API_URL = process.env.SMM_API_URL || "https://measmm.com/api/v2";
const SMM_API_KEY = process.env.SMM_API_KEY;

const dbFolder = path.join(__dirname, "data");
if (!fs.existsSync(dbFolder)) fs.mkdirSync(dbFolder, { recursive: true });

const db = new Database(path.join(dbFolder, "database.db"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

db.prepare(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT,
  email TEXT UNIQUE,
  senha TEXT,
  saldo REAL DEFAULT 0,
  tipo TEXT DEFAULT 'cliente'
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  servico TEXT,
  nome_servico TEXT,
  link TEXT,
  quantidade INTEGER,
  pedido_api_id TEXT,
  status TEXT DEFAULT 'pendente',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS configuracoes (
  chave TEXT PRIMARY KEY,
  valor TEXT
)
`).run();

const configExiste = db.prepare("SELECT * FROM configuracoes WHERE chave = ?").get("markup_percentual");
if (!configExiste) {
  db.prepare("INSERT INTO configuracoes (chave, valor) VALUES (?, ?)").run("markup_percentual", "100");
}

function getMarkup() {
  const row = db.prepare("SELECT valor FROM configuracoes WHERE chave = ?").get("markup_percentual");
  return Number(row?.valor || 100);
}

async function smmRequest(action, extra = {}) {
  const response = await fetch(SMM_API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      key: SMM_API_KEY,
      action,
      ...extra
    })
  });

  return response.json();
}

function layout(title, body) {
  return `
  <!DOCTYPE html>
  <html lang="pt-BR">
  <head>
    <meta charset="UTF-8">
    <title>${title}</title>
    <style>
      body { margin:0; font-family: Arial; background:#0f172a; color:#fff; }
      .box { max-width:1100px; margin:40px auto; background:#111827; padding:25px; border-radius:16px; }
      input, select, button { padding:12px; border-radius:8px; border:0; margin:5px; }
      button { background:#22c55e; color:#000; font-weight:bold; cursor:pointer; }
      table { width:100%; border-collapse:collapse; margin-top:20px; }
      th, td { padding:12px; border-bottom:1px solid #334155; text-align:left; }
      a { color:#38bdf8; text-decoration:none; margin-right:15px; }
      .card { display:inline-block; background:#1e293b; padding:20px; border-radius:12px; margin:10px; }
    </style>
  </head>
  <body>
    <div class="box">${body}</div>
  </body>
  </html>`;
}

app.get("/", (req, res) => res.redirect("/login"));

app.get("/login", (req, res) => {
  res.send(layout("Login", `
    <h1>Plataforma SMM</h1>
    <form method="POST" action="/login">
      <input name="email" placeholder="E-mail" required><br>
      <input name="senha" type="password" placeholder="Senha" required><br>
      <button>Entrar</button>
    </form>
    <p>Não tem conta? Use /cadastro-teste para criar uma conta teste.</p>
  `));
});

app.post("/login", (req, res) => {
  const { email, senha } = req.body;
  const user = db.prepare("SELECT * FROM usuarios WHERE email = ? AND senha = ?").get(email, senha);

  if (!user) return res.send("Usuário ou senha inválidos.");

  if (user.tipo === "admin") return res.redirect("/admin");
  res.redirect(`/dashboard?user=${user.id}`);
});

app.get("/cadastro-teste", (req, res) => {
  try {
    db.prepare("INSERT INTO usuarios (nome, email, senha, saldo, tipo) VALUES (?, ?, ?, ?, ?)")
      .run("Cliente Teste", "cliente@teste.com", "123456", 100, "cliente");
  } catch {}

  try {
    db.prepare("INSERT INTO usuarios (nome, email, senha, saldo, tipo) VALUES (?, ?, ?, ?, ?)")
      .run("Admin", process.env.ADMIN_EMAIL || "admin@sualoja.com", process.env.ADMIN_PASSWORD || "12345678", 0, "admin");
  } catch {}

  res.send("Contas criadas. Cliente: cliente@teste.com / 123456");
});

app.get("/dashboard", async (req, res) => {
  const userId = req.query.user || 1;
  const user = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(userId);
  const markup = getMarkup();

  let services = [];
  try {
    services = await smmRequest("services");
  } catch {}

  const lista = Array.isArray(services) ? services.slice(0, 80).map(s => {
    const custo = Number(s.rate || 0);
    const venda = custo + (custo * markup / 100);

    return `
      <tr>
        <td>${s.service}</td>
        <td>${s.name}</td>
        <td>R$ ${venda.toFixed(4)}</td>
        <td>${s.min} - ${s.max}</td>
        <td>
          <form method="POST" action="/pedido">
            <input type="hidden" name="usuario_id" value="${userId}">
            <input type="hidden" name="servico" value="${s.service}">
            <input type="hidden" name="nome_servico" value="${s.name}">
            <input name="link" placeholder="Link" required>
            <input name="quantidade" placeholder="Qtd" required>
            <button>Comprar</button>
          </form>
        </td>
      </tr>`;
  }).join("") : "<tr><td>Erro ao carregar serviços</td></tr>";

  res.send(layout("Dashboard", `
    <h1>Dashboard SMM</h1>
    <a href="/login">Sair</a>
    <div class="card">Cliente: ${user?.nome || "Cliente"}</div>
    <div class="card">Saldo: R$ ${(user?.saldo || 0).toFixed(2)}</div>
    <div class="card">Lucro configurado: ${markup}%</div>

    <h2>Comprar Serviços</h2>
    <table>
      <tr>
        <th>ID</th>
        <th>Serviço</th>
        <th>Preço venda</th>
        <th>Min/Máx</th>
        <th>Comprar</th>
      </tr>
      ${lista}
    </table>
  `));
});

app.post("/pedido", async (req, res) => {
  try {
    const { usuario_id, servico, nome_servico, link, quantidade } = req.body;

    const apiData = await smmRequest("add", {
      service: servico,
      link,
      quantity: quantidade
    });

    db.prepare(`
      INSERT INTO pedidos (usuario_id, servico, nome_servico, link, quantidade, pedido_api_id)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(usuario_id, servico, nome_servico, link, quantidade, apiData.order || null);

    res.send(`<h2>Pedido enviado!</h2><pre>${JSON.stringify(apiData, null, 2)}</pre><a href="/dashboard?user=${usuario_id}">Voltar</a>`);
  } catch (error) {
    res.send("Erro ao criar pedido: " + error.message);
  }
});

app.get("/admin", (req, res) => {
  const markup = getMarkup();
  const usuarios = db.prepare("SELECT * FROM usuarios").all();
  const pedidos = db.prepare("SELECT * FROM pedidos ORDER BY id DESC").all();

  res.send(layout("Admin", `
    <h1>Painel Admin</h1>
    <a href="/balance">Saldo API</a>
    <a href="/services">Serviços JSON</a>

    <h2>Percentual de lucro</h2>
    <form method="POST" action="/admin/markup">
      <input name="markup" value="${markup}" placeholder="Percentual">
      <button>Salvar percentual</button>
    </form>

    <h2>Usuários</h2>
    <pre>${JSON.stringify(usuarios, null, 2)}</pre>

    <h2>Pedidos</h2>
    <pre>${JSON.stringify(pedidos, null, 2)}</pre>
  `));
});

app.post("/admin/markup", (req, res) => {
  const markup = req.body.markup || 100;
  db.prepare("UPDATE configuracoes SET valor = ? WHERE chave = ?").run(markup, "markup_percentual");
  res.redirect("/admin");
});

app.get("/services", async (req, res) => {
  const data = await smmRequest("services");
  res.json(data);
});

app.get("/balance", async (req, res) => {
  const data = await smmRequest("balance");
  res.json(data);
});

app.get("/pedidos", (req, res) => {
  res.json(db.prepare("SELECT * FROM pedidos").all());
});

app.get("/usuarios", (req, res) => {
  res.json(db.prepare("SELECT * FROM usuarios").all());
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
