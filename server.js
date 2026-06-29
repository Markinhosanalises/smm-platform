const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

const SMM_API_URL = process.env.SMM_API_URL || "https://measmm.com/api/v2";
const SMM_API_KEY = process.env.SMM_API_KEY || "23ddeq349Prdxazd1223avvcz";

// banco local
const dbFolder = path.join(__dirname, "data");

if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder, { recursive: true });
}

const db = new Database(path.join(dbFolder, "database.db"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// tabelas
db.prepare(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  saldo REAL DEFAULT 0
)
`).run();

db.prepare(`
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  servico TEXT,
  link TEXT,
  quantidade INTEGER,
  pedido_api_id TEXT,
  status TEXT DEFAULT 'pendente',
  criado_em DATETIME DEFAULT CURRENT_TIMESTAMP
)
`).run();

// HOME
app.get("/", (req, res) => {
  res.redirect("/login");
});

// LOGIN
app.get("/login", (req, res) => {
  res.send(`
    <h1>Login Plataforma SMM</h1>
    <form method="POST" action="/login">
      <input name="email" placeholder="Digite seu e-mail" /><br><br>
      <input name="senha" type="password" placeholder="Digite sua senha" /><br><br>
      <button type="submit">Entrar</button>
    </form>
  `);
});

// PROCESSA LOGIN
app.post("/login", (req, res) => {
  const { email, senha } = req.body;

  const usuario = db.prepare(`
    SELECT * FROM usuarios WHERE email = ? AND senha = ?
  `).get(email, senha);

  if (!usuario) {
    return res.send("Usuário ou senha inválidos");
  }

  res.redirect("/dashboard");
});

// DASHBOARD
app.get("/dashboard", (req, res) => {
  res.send(`
    <h1>Painel SMM 🚀</h1>
    <ul>
      <li><a href="/services">Listar serviços</a></li>
      <li><a href="/balance">Ver saldo API</a></li>
      <li><a href="/pedidos">Ver pedidos</a></li>
      <li><a href="/usuarios">Ver usuários</a></li>
    </ul>
  `);
});

// CADASTRO
app.post("/cadastro", (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    db.prepare(`
      INSERT INTO usuarios (nome, email, senha)
      VALUES (?, ?, ?)
    `).run(nome, email, senha);

    res.json({ status: "ok" });
  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// LISTAR SERVIÇOS DA API
app.get("/services", async (req, res) => {
  try {
    const response = await fetch(SMM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: SMM_API_KEY,
        action: "services"
      })
    });

    const data = await response.json();
    res.json(data);

  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// VER SALDO
app.get("/balance", async (req, res) => {
  try {
    const response = await fetch(SMM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: SMM_API_KEY,
        action: "balance"
      })
    });

    const data = await response.json();
    res.json(data);

  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// CRIAR PEDIDO REAL
app.post("/pedido", async (req, res) => {
  try {
    const { usuario_id, servico, link, quantidade } = req.body;

    const response = await fetch(SMM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: SMM_API_KEY,
        action: "add",
        service: servico,
        link: link,
        quantity: quantidade
      })
    });

    const apiData = await response.json();

    db.prepare(`
      INSERT INTO pedidos (usuario_id, servico, link, quantidade, pedido_api_id)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      usuario_id,
      servico,
      link,
      quantidade,
      apiData.order || null
    );

    res.json(apiData);

  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// STATUS DO PEDIDO
app.get("/status/:id", async (req, res) => {
  try {
    const response = await fetch(SMM_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        key: SMM_API_KEY,
        action: "status",
        order: req.params.id
      })
    });

    const data = await response.json();
    res.json(data);

  } catch (error) {
    res.status(500).json({ erro: error.message });
  }
});

// PEDIDOS LOCAIS
app.get("/pedidos", (req, res) => {
  const pedidos = db.prepare("SELECT * FROM pedidos").all();
  res.json(pedidos);
});

// USUÁRIOS
app.get("/usuarios", (req, res) => {
  const usuarios = db.prepare("SELECT * FROM usuarios").all();
  res.json(usuarios);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
