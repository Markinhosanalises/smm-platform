const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// pasta do banco
const dbFolder = path.join(__dirname, "data");

// cria a pasta se não existir
if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder, { recursive: true });
}

// conecta banco
const db = new Database(path.join(dbFolder, "database.db"));

// middlewares
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// arquivos públicos
app.use(express.static(path.join(__dirname, "public")));

// cria tabela usuários
db.prepare(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  senha TEXT NOT NULL,
  saldo REAL DEFAULT 0
)
`).run();

// cria tabela pedidos
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

// rota inicial
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

// login
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

// dashboard
app.get("/dashboard", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "dashboard.html"));
});

// cadastro
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

// criar pedido
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

// listar pedidos
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

// listar usuários
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

// iniciar servidor
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
