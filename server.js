const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// cria pasta data se não existir
const dbFolder = path.join(__dirname, "data");

if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder, { recursive: true });
}

// conecta banco
const db = new Database(path.join(dbFolder, "database.db"));

// middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// tabela usuários
db.prepare(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  saldo REAL DEFAULT 0
)
`).run();

// tabela pedidos
db.prepare(`
CREATE TABLE IF NOT EXISTS pedidos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id INTEGER,
  servico TEXT,
  link TEXT,
  quantidade INTEGER,
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
  const pedidos = db.prepare("SELECT * FROM pedidos").all();

  let lista = pedidos.map(p =>
    `<li>${p.servico} - ${p.quantidade} - ${p.status}</li>`
  ).join("");

  res.send(`
    <h1>Dashboard SMM</h1>
    <p>Painel funcionando 🚀</p>
    <a href="/usuarios">Ver usuários</a><br><br>
    <a href="/pedidos">Ver pedidos (JSON)</a>
    <h2>Pedidos:</h2>
    <ul>${lista}</ul>
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

    res.json({
      status: "ok",
      mensagem: "Usuário cadastrado com sucesso"
    });

  } catch (error) {
    res.status(500).json({
      status: "erro",
      mensagem: error.message
    });
  }
});

// NOVO PEDIDO
app.post("/pedido", (req, res) => {
  try {
    const { usuario_id, servico, link, quantidade } = req.body;

    db.prepare(`
      INSERT INTO pedidos (usuario_id, servico, link, quantidade)
      VALUES (?, ?, ?, ?)
    `).run(usuario_id, servico, link, quantidade);

    res.json({
      status: "ok",
      mensagem: "Pedido criado com sucesso"
    });

  } catch (error) {
    res.status(500).json({
      status: "erro",
      mensagem: error.message
    });
  }
});

// LISTA PEDIDOS
app.get("/pedidos", (req, res) => {
  try {
    const pedidos = db.prepare("SELECT * FROM pedidos").all();
    res.json(pedidos);

  } catch (error) {
    res.status(500).json({
      status: "erro",
      mensagem: error.message
    });
  }
});

// LISTA USUÁRIOS
app.get("/usuarios", (req, res) => {
  try {
    const usuarios = db.prepare("SELECT * FROM usuarios").all();
    res.json(usuarios);

  } catch (error) {
    res.status(500).json({
      status: "erro",
      mensagem: error.message
    });
  }
});

// inicia servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
