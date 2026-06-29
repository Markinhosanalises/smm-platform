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

function layout(title, content) {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} | Fênix Social</title>
<style>
*{box-sizing:border-box}
body{
  margin:0;
  font-family:Inter,Arial,sans-serif;
  background:#070b18;
  color:#fff;
}
a{text-decoration:none;color:inherit}
.btn{
  background:linear-gradient(135deg,#7c3aed,#a855f7);
  color:white;
  padding:12px 18px;
  border:0;
  border-radius:10px;
  cursor:pointer;
  font-weight:700;
}
.btn-dark{
  background:#111827;
  border:1px solid #253047;
}
input,select{
  width:100%;
  padding:13px;
  background:#0b1220;
  border:1px solid #263249;
  color:white;
  border-radius:10px;
  margin:7px 0;
}
.card{
  background:linear-gradient(180deg,#111827,#0b1220);
  border:1px solid #253047;
  border-radius:18px;
  padding:22px;
  box-shadow:0 20px 60px rgba(0,0,0,.25);
}
.logo{
  font-size:24px;
  font-weight:900;
  display:flex;
  align-items:center;
  gap:10px;
}
.logo span{color:#a855f7}
.nav{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding:24px 6%;
}
.nav-links a{margin:0 14px;color:#cbd5e1;font-size:14px}
.hero{
  min-height:90vh;
  padding:30px 6%;
  background:
    radial-gradient(circle at 75% 30%,rgba(124,58,237,.35),transparent 35%),
    radial-gradient(circle at 20% 80%,rgba(34,197,94,.12),transparent 30%);
}
.hero-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  align-items:center;
  gap:40px;
  margin-top:50px;
}
.hero h1{
  font-size:56px;
  line-height:1.05;
  margin:0 0 18px;
}
.hero h1 span{color:#a855f7}
.hero p{color:#cbd5e1;font-size:18px;line-height:1.6;max-width:560px}
.hero-phone{
  height:430px;
  border-radius:34px;
  background:linear-gradient(145deg,#111827,#050816);
  border:1px solid #334155;
  display:flex;
  align-items:center;
  justify-content:center;
  position:relative;
}
.hero-phone:before{
  content:"🦅";
  font-size:120px;
  filter:drop-shadow(0 0 30px #7c3aed);
}
.stats{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:16px;
  margin-top:50px;
}
.stat{
  padding:22px;
  border-radius:16px;
  background:rgba(15,23,42,.8);
  border:1px solid #253047;
}
.login-wrap{
  min-height:100vh;
  display:flex;
  align-items:center;
  justify-content:center;
  background:
    radial-gradient(circle at 50% 10%,rgba(124,58,237,.4),transparent 35%),
    #070b18;
}
.login-box{
  width:420px;
  text-align:center;
}
.login-box h1{margin-bottom:8px}
.login-box p{color:#94a3b8}
.app{
  display:grid;
  grid-template-columns:260px 1fr;
  min-height:100vh;
}
.sidebar{
  background:#070b18;
  border-right:1px solid #1e293b;
  padding:24px;
}
.menu a{
  display:block;
  padding:13px 14px;
  margin:8px 0;
  color:#cbd5e1;
  border-radius:10px;
}
.menu a.active,.menu a:hover{
  background:linear-gradient(135deg,#4c1d95,#7c3aed);
  color:white;
}
.main{
  padding:28px;
  background:#0b1020;
}
.top{
  display:flex;
  justify-content:space-between;
  align-items:center;
  margin-bottom:25px;
}
.cards{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:16px;
  margin-bottom:22px;
}
.card h3{margin:0;color:#94a3b8;font-size:14px}
.card strong{font-size:26px;display:block;margin-top:10px}
.table-wrap{overflow:auto}
table{
  width:100%;
  border-collapse:collapse;
  min-width:900px;
}
th,td{
  padding:14px;
  border-bottom:1px solid #243047;
  color:#e5e7eb;
  font-size:14px;
}
th{color:#94a3b8;text-align:left}
.badge{
  padding:6px 10px;
  border-radius:999px;
  background:#14532d;
  color:#86efac;
  font-size:12px;
}
.search{
  margin:15px 0;
}
.admin-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:20px;
}
@media(max-width:900px){
  .hero-grid,.stats,.cards,.admin-grid{grid-template-columns:1fr}
  .hero h1{font-size:38px}
  .app{grid-template-columns:1fr}
  .sidebar{position:relative}
}
</style>
</head>
<body>
${content}
</body>
</html>
`;
}

app.get("/", (req, res) => {
  res.send(layout("Início", `
<section class="hero">
  <div class="nav">
    <div class="logo">🦅 FÊNIX <span>SOCIAL</span></div>
    <div class="nav-links">
      <a href="/">Início</a>
      <a href="/services">Serviços</a>
      <a href="/login">Entrar</a>
      <a href="/cadastro-teste" class="btn">Criar Conta</a>
    </div>
  </div>

  <div class="hero-grid">
    <div>
      <h1>Impulsione suas redes sociais com <span>qualidade e segurança</span></h1>
      <p>Compre serviços para Instagram, TikTok, YouTube e outras redes com entrega rápida, painel limpo e suporte para clientes e revendedores.</p>
      <br>
      <a href="/cadastro-teste" class="btn">Criar minha conta</a>
      <a href="/login" class="btn btn-dark">Entrar</a>
    </div>
    <div class="hero-phone"></div>
  </div>

  <div class="stats">
    <div class="stat"><h2>10K+</h2><p>Clientes ativos</p></div>
    <div class="stat"><h2>500K+</h2><p>Pedidos entregues</p></div>
    <div class="stat"><h2>99.9%</h2><p>Satisfação</p></div>
    <div class="stat"><h2>24/7</h2><p>Suporte online</p></div>
  </div>
</section>
  `));
});

app.get("/login", (req, res) => {
  res.send(layout("Login", `
<div class="login-wrap">
  <div class="login-box card">
    <div class="logo" style="justify-content:center">🦅 FÊNIX <span>SOCIAL</span></div>
    <h1>Bem-vindo de volta</h1>
    <p>Acesse sua conta para comprar serviços.</p>

    <form method="POST" action="/login">
      <input name="email" placeholder="E-mail" required>
      <input name="senha" type="password" placeholder="Senha" required>
      <button class="btn" style="width:100%">Entrar</button>
    </form>

    <p>Conta teste: cliente@teste.com / 123456</p>
  </div>
</div>
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
    db.prepare("INSERT INTO usuarios (nome,email,senha,saldo,tipo) VALUES (?,?,?,?,?)")
      .run("Cliente Teste", "cliente@teste.com", "123456", 100, "cliente");
  } catch {}

  try {
    db.prepare("INSERT INTO usuarios (nome,email,senha,saldo,tipo) VALUES (?,?,?,?,?)")
      .run("Admin", process.env.ADMIN_EMAIL || "admin@sualoja.com", process.env.ADMIN_PASSWORD || "12345678", 0, "admin");
  } catch {}

  res.redirect("/login");
});

function sidebar(active = "dashboard") {
  return `
  <aside class="sidebar">
    <div class="logo">🦅 FÊNIX <span>SOCIAL</span></div>
    <br>
    <nav class="menu">
      <a class="${active==="dashboard"?"active":""}" href="/dashboard?user=1">Dashboard</a>
      <a href="/dashboard?user=1">Novo Pedido</a>
      <a href="/services">Serviços JSON</a>
      <a href="/pedidos">Pedidos</a>
      <a href="/balance">Saldo API</a>
      <a href="/admin">Admin</a>
      <a href="/login">Sair</a>
    </nav>
  </aside>`;
}

app.get("/dashboard", async (req, res) => {
  const userId = req.query.user || 1;
  const user = db.prepare("SELECT * FROM usuarios WHERE id = ?").get(userId);
  const pedidos = db.prepare("SELECT * FROM pedidos WHERE usuario_id = ? ORDER BY id DESC").all(userId);
  const markup = getMarkup();

  let services = [];
  try { services = await smmRequest("services"); } catch {}

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
          <input name="link" placeholder="Link do perfil/post" required>
          <input name="quantidade" placeholder="Qtd" required>
          <button class="btn">Comprar</button>
        </form>
      </td>
    </tr>`;
  }).join("") : "";

  res.send(layout("Dashboard", `
<div class="app">
  ${sidebar("dashboard")}
  <main class="main">
    <div class="top">
      <div>
        <h1>Dashboard</h1>
        <p style="color:#94a3b8">Bem-vindo(a), ${user?.nome || "Cliente"}.</p>
      </div>
      <div class="card">Saldo<br><strong>R$ ${(user?.saldo || 0).toFixed(2)}</strong></div>
    </div>

    <div class="cards">
      <div class="card"><h3>Saldo atual</h3><strong>R$ ${(user?.saldo || 0).toFixed(2)}</strong></div>
      <div class="card"><h3>Pedidos</h3><strong>${pedidos.length}</strong></div>
      <div class="card"><h3>Markup</h3><strong>${markup}%</strong></div>
      <div class="card"><h3>Status</h3><strong>Online</strong></div>
    </div>

    <div class="card">
      <h2>Novo Pedido</h2>
      <input class="search" placeholder="Buscar serviço...">
      <div class="table-wrap">
        <table>
          <tr>
            <th>ID</th>
            <th>Serviço</th>
            <th>Preço</th>
            <th>Min/Máx</th>
            <th>Ação</th>
          </tr>
          ${lista}
        </table>
      </div>
    </div>
  </main>
</div>
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

    res.redirect(`/dashboard?user=${usuario_id}`);
  } catch (error) {
    res.send("Erro ao criar pedido: " + error.message);
  }
});

app.get("/admin", (req, res) => {
  const markup = getMarkup();
  const usuarios = db.prepare("SELECT * FROM usuarios").all();
  const pedidos = db.prepare("SELECT * FROM pedidos ORDER BY id DESC").all();

  res.send(layout("Admin", `
<div class="app">
  ${sidebar("admin")}
  <main class="main">
    <h1>Painel Admin</h1>

    <div class="cards">
      <div class="card"><h3>Usuários</h3><strong>${usuarios.length}</strong></div>
      <div class="card"><h3>Pedidos</h3><strong>${pedidos.length}</strong></div>
      <div class="card"><h3>Lucro atual</h3><strong>${markup}%</strong></div>
      <div class="card"><h3>API</h3><strong>Online</strong></div>
    </div>

    <div class="admin-grid">
      <div class="card">
        <h2>Percentual de lucro</h2>
        <form method="POST" action="/admin/markup">
          <input name="markup" value="${markup}" placeholder="Percentual">
          <button class="btn">Salvar percentual</button>
        </form>
      </div>

      <div class="card">
        <h2>Links rápidos</h2>
        <p><a href="/balance">Ver saldo API</a></p>
        <p><a href="/services">Ver serviços JSON</a></p>
        <p><a href="/pedidos">Ver pedidos JSON</a></p>
      </div>
    </div>

    <div class="card" style="margin-top:20px">
      <h2>Últimos pedidos</h2>
      <pre>${JSON.stringify(pedidos.slice(0,10), null, 2)}</pre>
    </div>
  </main>
</div>
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
