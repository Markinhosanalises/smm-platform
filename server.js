const express = require("express");
const path = require("path");
const fs = require("fs");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

// garante que a pasta "dados" exista
const dbFolder = path.join(__dirname, "dados");

if (!fs.existsSync(dbFolder)) {
  fs.mkdirSync(dbFolder, { recursive: true });
}

// banco agora usa "dados"
const db = new Database(path.join(dbFolder, "database.db"));

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "publico")));

// criar tabelas
db.prepare(`
CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT,
  email TEXT,
  senha TEXT,
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
  status TEXT DEFAULT 'pendente'
)
`).run();

// rota inicial
app.get("/", (req, res) => {
  res.send("Plataforma SMM Online 🚀");
});

// cadastro
app.post("/cadastro", (req, res) => {
  const { nome, email, senha } = req.body;

  db.prepare(`
    INSERT INTO usuarios (nome, email, senha)
    VALUES (?, ?, ?)
  `).run(nome, email, senha);

  res.json({ status: "ok", mensagem: "Usuário cadastrado" });
});

// criar pedido
app.post("/pedido", (req, res) => {
  const { usuario_id, servico, link, quantidade } = req.body;

  db.prepare(`
    INSERT INTO pedidos (usuario_id, servico, link, quantidade)
    VALUES (?, ?, ?, ?)
  `).run(usuario_id, servico, link, quantidade);

  res.json({ status: "ok", mensagem: "Pedido criado" });
});

// listar pedidos
app.get("/pedidos", (req, res) => {
  const pedidos = db.prepare("SELECT * FROM pedidos").all();
  res.json(pedidos);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
