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

function layout(title, body) {
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
  background:#f7f8fc;
  color:#101828;
}
a{text-decoration:none;color:inherit}
button,.btn{
  background:#6c3df4;
  color:#fff;
  border:none;
  border-radius:14px;
  padding:13px 22px;
  font-weight:800;
  cursor:pointer;
}
.btn-light{
  background:#fff;
  color:#6c3df4;
  border:1px solid #e5e7eb;
}
input,select{
  width:100%;
  padding:14px;
  border:1px solid #e5e7eb;
  border-radius:14px;
  margin:7px 0;
  outline:none;
}
.header{
  width:100%;
  padding:24px 7%;
  display:flex;
  justify-content:space-between;
  align-items:center;
}
.logo{
  font-size:24px;
  font-weight:900;
}
.logo span{color:#6c3df4}
.nav a{
  margin:0 14px;
  color:#475467;
  font-weight:700;
}
.hero{
  padding:30px 7% 70px;
  background:linear-gradient(135deg,#f6f3ff,#ffffff);
}
.hero-grid{
  display:grid;
  grid-template-columns:1.1fr .9fr;
  gap:45px;
  align-items:center;
}
.hero h1{
  font-size:58px;
  line-height:1.05;
  margin:20px 0;
}
.hero h1 span{color:#6c3df4}
.hero p{
  font-size:18px;
  color:#667085;
  line-height:1.6;
}
.login-card,.card{
  background:#fff;
  border:1px solid #eef0f5;
  border-radius:28px;
  padding:28px;
  box-shadow:0 25px 80px rgba(16,24,40,.08);
}
.login-card h2{margin-top:0}
.stats{
  display:grid;
  grid-template-columns:repeat(3,1fr);
  gap:18px;
  margin-top:40px;
}
.stat{
  background:#fff;
  border-radius:22px;
  padding:24px;
  box-shadow:0 15px 50px rgba(16,24,40,.06);
}
.stat h2{color:#6c3df4;margin:0}
.section{
  padding:70px 7%;
}
.section h2{
  font-size:38px;
  margin-bottom:10px;
}
.grid-4{
  display:grid;
  grid-template-columns:repeat(4,1fr);
  gap:20px;
  margin-top:30px;
}
.feature{
  background:#fff;
  border-radius:24px;
  padding:26px;
  border:1px solid #eef0f5;
}
.feature b{
  display:block;
  font-size:18px;
  margin-bottom:10px;
}
.feature p{color:#667085}
.app{
  display:grid;
  grid-template-columns:270px 1fr;
  min-height:100vh;
}
.sidebar{
  background:#fff;
  border-right:1px solid #eef0f5;
  padding:28px;
}
.menu a{
  display:block;
  padding:14px;
  border-radius:14px;
  color:#475467;
  margin:7px 0;
  font-weight:700;
}
.menu a.active,.menu a:hover{
  background:#6c3df4;
  color:#fff;
}
.main{
  padding:30px;
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
  gap:18px;
  margin-bottom:24px;
}
.card h3{
  margin:0;
  color:#667085;
  font-size:14px;
}
.card strong{
  font-size:27px;
  display:block;
  margin-top:10px;
}
.table-wrap{overflow:auto}
table{
  width:100%;
  border-collapse:collapse;
  min-width:920px;
}
th,td{
  padding:15px;
  border-bottom:1px solid #eef0f5;
  text-align:left;
  font-size:14px;
}
th{color:#667085}
.badge{
  background:#dcfce7;
  color:#166534;
  padding:7px 12px;
  border-radius:99px;
  font-weight:800;
}
.admin-grid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:20px;
}
@media(max-width:950px){
  .hero-grid,.stats,.grid-4,.cards,.admin-grid,.app{
    grid-template-columns:1fr;
  }
  .hero h1{font-size:40px}
  .nav{display:none}
}
</style>
</head>
<body>
${body}
</body>
</html>
`;
}

function sidebar(active = "dashboard") {
  return `
<aside class="sidebar">
  <div class="logo">🔥 Fênix <span>Social</span></div>
  <br>
  <nav class="menu">
    <a class="${active === "dashboard" ? "active" : ""}" href="/dashboard?user=1">Dashboard</a>
    <a href="/dashboard?user=1">Novo Pedido</a>
    <a href="/balance">Saldo API</a>
    <a href="/pedidos">Pedidos</a>
    <a href="/admin">Admin</a>
    <a href="/login">Sair</a>
  </nav>
</aside>`;
}

app.get("/", (req, res) => {
  res.send(layout("Início", `
<header class="header">
  <div class="logo">🔥 Fênix <span>Social</span></div>
  <nav class="nav">
    <a href="/">Início</a>
    <a href="#servicos">Serviços</a>
    <a href="#como-funciona">Como funciona</a>
    <a href="/login">Login</a>
    <a class="btn" href="/cadastro-teste">Criar conta</a>
  </nav>
</header>

<section class="hero">
  <div class="hero-grid">
    <div>
      <p><b>PAINEL SMM PROFISSIONAL</b></p>
      <h1>Impulsione suas redes sociais com <span>rapidez e segurança</span></h1>
      <p>Compre serviços para Instagram, TikTok, YouTube e outras redes em uma plataforma simples, rápida e confortável para clientes e revendedores.</p>
      <br>
      <a class="btn" href="/cadastro-teste">Começar agora</a>
      <a class="btn btn-light" href="#servicos">Ver serviços</a>

      <div class="stats">
        <div class="stat"><h2>24/7</h2><p>Atendimento online</p></div>
        <div class="stat"><h2>+20</h2><p>Plataformas sociais</p></div>
        <div class="stat"><h2>Rápido</h2><p>Pedidos automáticos</p></div>
      </div>
    </div>

    <div class="login-card">
      <h2>Entrar na conta</h2>
      <p>Acesse seu painel Fênix Social.</p>
      <form method="POST" action="/login">
        <input name="email" placeholder="E-mail" required>
        <input name="senha" type="password" placeholder="Senha" required>
        <button style="width:100%">Login</button>
      </form>
      <p style="color:#667085">Conta teste: cliente@teste.com / 123456</p>
    </div>
  </div>
</section>

<section class="section" id="servicos">
  <h2>Serviços para todas as redes</h2>
  <p style="color:#667085">Instagram, TikTok, YouTube, Facebook, Telegram, Spotify e muito mais.</p>
  <div class="grid-4">
    <div class="feature"><b>📸 Instagram</b><p>Seguidores, curtidas, visualizações e engajamento.</p></div>
    <div class="feature"><b>🎵 TikTok</b><p>Impulsione vídeos, seguidores e alcance.</p></div>
    <div class="feature"><b>▶️ YouTube</b><p>Visualizações, inscritos e interações.</p></div>
    <div class="feature"><b>💬 Telegram</b><p>Membros, views e crescimento de canais.</p></div>
  </div>
</section>

<section class="section" id="como-funciona">
  <h2>Como funciona?</h2>
  <div class="grid-4">
    <div class="feature"><b>1. Crie sua conta</b><p>Cadastre-se em poucos segundos.</p></div>
    <div class="feature"><b>2. Adicione saldo</b><p>Carregue sua conta para comprar serviços.</p></div>
    <div class="feature"><b>3. Escolha o serviço</b><p>Selecione rede social, link e quantidade.</p></div>
    <div class="feature"><b>4. Acompanhe</b><p>Veja seus pedidos pelo painel.</p></div>
  </div>
</section>
`));
});

app.get("/login", (req, res) => res.redirect("/"));

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

  res.redirect("/");
});

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
      <input name="link" placeholder="Link" required>
      <input name="quantidade" placeholder="Qtd" required>
      <button>Comprar</button>
    </form>
  </td>
</tr>`;
  }).join("") : "<tr><td>Erro ao carregar serviços</td></tr>";

  res.send(layout("Dashboard", `
<div class="app">
  ${sidebar("dashboard")}
  <main class="main">
    <div class="top">
      <div>
        <h1>Dashboard</h1>
        <p style="color:#667085">Bem-vindo(a), ${user?.nome || "Cliente"}.</p>
      </div>
      <a class="btn" href="/">Ver site</a>
    </div>

    <div class="cards">
      <div class="card"><h3>Saldo atual</h3><strong>R$ ${(user?.saldo || 0).toFixed(2)}</strong></div>
      <div class="card"><h3>Pedidos</h3><strong>${pedidos.length}</strong></div>
      <div class="card"><h3>Lucro</h3><strong>${markup}%</strong></div>
      <div class="card"><h3>Status</h3><strong>Online</strong></div>
    </div>

    <div class="card">
      <h2>Novo pedido</h2>
      <div class="table-wrap">
        <table>
          <tr><th>ID</th><th>Serviço</th><th>Preço</th><th>Min/Máx</th><th>Ação</th></tr>
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
      <div class="card"><h3>Markup</h3><strong>${markup}%</strong></div>
      <div class="card"><h3>API</h3><strong>Online</strong></div>
    </div>

    <div class="admin-grid">
      <div class="card">
        <h2>Percentual de lucro</h2>
        <form method="POST" action="/admin/markup">
          <input name="markup" value="${markup}">
          <button>Salvar</button>
        </form>
      </div>

      <div class="card">
        <h2>Links rápidos</h2>
        <p><a href="/balance">Saldo API</a></p>
        <p><a href="/services">Serviços JSON</a></p>
        <p><a href="/pedidos">Pedidos JSON</a></p>
      </div>
    </div>
  </main>
</div>
`));
});

app.post("/admin/markup", (req, res) => {
  db.prepare("UPDATE configuracoes SET valor = ? WHERE chave = ?")
    .run(req.body.markup || 100, "markup_percentual");
  res.redirect("/admin");
});

app.get("/services", async (req, res) => res.json(await smmRequest("services")));
app.get("/balance", async (req, res) => res.json(await smmRequest("balance")));
app.get("/pedidos", (req, res) => res.json(db.prepare("SELECT * FROM pedidos").all()));
app.get("/usuarios", (req, res) => res.json(db.prepare("SELECT * FROM usuarios").all()));

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
