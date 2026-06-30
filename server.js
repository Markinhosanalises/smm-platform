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

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

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

if (!db.prepare("SELECT * FROM configuracoes WHERE chave = ?").get("markup_percentual")) {
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

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/login", (req, res) => {
  res.render("login", { error: null });
});

app.post("/login", (req, res) => {
  const { email, password, senha } = req.body;
  const finalSenha = password || senha;

  const user = db
    .prepare("SELECT * FROM usuarios WHERE email = ? AND senha = ?")
    .get(email, finalSenha);

  if (!user) {
    return res.render("login", { error: "Usuário ou senha inválidos." });
  }

  if (user.tipo === "admin") return res.redirect("/admin");

  res.redirect(`/dashboard?user=${user.id}`);
});

app.get("/register", (req, res) => {
  res.render("register", { error: null });
});

app.post("/register", (req, res) => {
  try {
    const { name, nome, email, password, senha } = req.body;

    db.prepare(`
      INSERT INTO usuarios (nome, email, senha, saldo, tipo)
      VALUES (?, ?, ?, ?, ?)
    `).run(name || nome, email, password || senha, 0, "cliente");

    res.redirect("/login");
  } catch (error) {
    res.render("register", { error: "Não foi possível criar a conta. Talvez esse e-mail já exista." });
  }
});

app.get("/cadastro-teste", (req, res) => {
  try {
    db.prepare(`
      INSERT INTO usuarios (nome, email, senha, saldo, tipo)
      VALUES (?, ?, ?, ?, ?)
    `).run("Cliente Teste", "cliente@teste.com", "123456", 100, "cliente");
  } catch {}

  try {
    db.prepare(`
      INSERT INTO usuarios (nome, email, senha, saldo, tipo)
      VALUES (?, ?, ?, ?, ?)
    `).run(
      "Admin",
      process.env.ADMIN_EMAIL || "admin@sualoja.com",
      process.env.ADMIN_PASSWORD || "12345678",
      0,
      "admin"
    );
  } catch {}

  res.redirect("/login");
});

app.get("/dashboard", async (req, res) => {
  const userId = req.query.user || 1;
  const user = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(userId);
  const pedidos = db.prepare("SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY id DESC").all(userId);
  const markup = getMarkup();

  let services = [];
  try {
    services = await smmRequest("services");
  } catch {
    services = [];
  }

  res.render("dashboard", {
    user,
    pedidos,
    services,
    markup,
    userId
  });
});

app.get("/order", async (req, res) => {
  const userId = req.query.user || 1;
  let services = [];

  try {
    services = await smmRequest("services");
  } catch {
    services = [];
  }

  res.render("order", {
    services,
    markup: getMarkup(),
    userId
  });
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
    `).run(
      usuario_id,
      servico,
      nome_servico,
      link,
      quantidade,
      apiData.order || null
    );

    res.redirect(`/dashboard?user=${usuario_id}`);
  } catch (error) {
    res.send("Erro ao criar pedido: " + error.message);
  }
});

app.get("/admin", (req, res) => {
  const markup = getMarkup();
  const pedidos = db.prepare("SELECT * FROM pedidos ORDER BY id DESC").all();
  const usuarios = db.prepare("SELECT * FROM usuarios ORDER BY id DESC").all();

  res.render("admin", {
    markup,
    pedidos,
    usuarios
  });
});

app.post("/admin/markup", (req, res) => {
  db.prepare("UPDATE configuracoes SET valor = ? WHERE chave = ?")
    .run(req.body.markup || 100, "markup_percentual");

  res.redirect("/admin");
});

app.get("/services", async (req, res) => {
  res.json(await smmRequest("services"));
});

app.get("/balance", async (req, res) => {
  res.json(await smmRequest("balance"));
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
