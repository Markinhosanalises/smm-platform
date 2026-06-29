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
body{margin:0;font-family:Arial,sans-serif;background:#f6f7fb;color:#101828}
a{text-decoration:none;color:inherit}
.header{padding:22px 7%;display:flex;justify-content:space-between;align-items:center;background:#fff;border-bottom:1px solid #eef0f5;position:sticky;top:0;z-index:10}
.logo{font-size:25px;font-weight:900}.logo span{color:#6d38ff}
.nav a{margin:0 13px;color:#475467;font-weight:700}
.btn,button{background:#6d38ff;color:#fff;border:0;border-radius:12px;padding:13px 22px;font-weight:800;cursor:pointer}
.btn-outline{background:#fff;color:#6d38ff;border:1px solid #ded7ff}
.hero{padding:75px 7%;background:linear-gradient(135deg,#fff,#f1edff)}
.hero-grid{display:grid;grid-template-columns:1.1fr .9fr;gap:45px;align-items:center}
.hero h1{font-size:56px;line-height:1.05;margin:10px 0}.hero h1 span{color:#6d38ff}
.hero p{font-size:18px;color:#667085;line-height:1.6}
.hero-card{background:#fff;border-radius:28px;padding:30px;box-shadow:0 25px 80px rgba(16,24,40,.10)}
.hero-card ul{padding-left:20px;color:#475467;line-height:2}
.section{padding:70px 7%}.section h2{font-size:38px;margin:0 0 10px}
.muted{color:#667085}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:22px;margin-top:30px}
.card{background:#fff;border:1px solid #eef0f5;border-radius:24px;padding:26px;box-shadow:0 18px 50px rgba(16,24,40,.06)}
.card h3{margin-top:0}
.steps{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-top:30px}
.step{background:#fff;border-radius:22px;padding:24px;border:1px solid #eef0f5}
.login-box{max-width:430px;margin:80px auto;background:#fff;border-radius:26px;padding:32px;box-shadow:0 25px 80px rgba(16,24,40,.10)}
input,select{width:100%;padding:14px;border:1px solid #e5e7eb;border-radius:12px;margin:7px 0}
.app{display:grid;grid-template-columns:270px 1fr;min-height:100vh}
.sidebar{background:#fff;border-right:1px solid #eef0f5;padding:28px}
.menu a{display:block;padding:14px;border-radius:12px;color:#475467;font-weight:700;margin:7px 0}
.menu a.active,.menu a:hover{background:#6d38ff;color:#fff}
.main{padding:30px}
.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:24px}
table{width:100%;border-collapse:collapse;min-width:900px}
th,td{padding:14px;border-bottom:1px solid #eef0f5;text-align:left;font-size:14px}
.table-wrap{overflow:auto}
.footer{padding:35px 7%;background:#101828;color:#cbd5e1}
@media(max-width:900px){.hero-grid,.grid,.steps,.cards,.app{grid-template-columns:1fr}.hero h1{font-size:38px}.nav{display:none}}
</style>
</head>
<body>${body}</body>
</html>`;
}

function sidebar(active="dashboard") {
  return `
<aside class="sidebar">
  <div class="logo">🔥 Fênix <span>Social</span></div><br>
  <nav class="menu">
    <a class="${active==="dashboard"?"active":""}" href="/dashboard?user=1">Dashboard</a>
    <a href="/dashboard?user=1">Novo Pedido</a>
    <a href="/pedidos">Pedidos</a>
    <a href="/balance">Saldo API</a>
    <a href="/admin">Admin</a>
    <a href="/">Site</a>
  </nav>
</aside>`;
}

app.get("/", (req,res)=>{
res.send(layout("Início", `
<header class="header">
  <div class="logo">🔥 Fênix <span>Social</span></div>
  <nav class="nav">
    <a href="/">Início</a>
    <a href="#solucoes">Soluções</a>
    <a href="#como-funciona">Como funciona</a>
    <a href="#beneficios">Benefícios</a>
    <a href="/login">Entrar</a>
    <a class="btn" href="/cadastro-teste">Criar conta</a>
  </nav>
</header>

<section class="hero">
  <div class="hero-grid">
    <div>
      <p><b>PLATAFORMA DE CRESCIMENTO DIGITAL</b></p>
      <h1>Organize e impulsione sua presença online com a <span>Fênix Social</span></h1>
      <p>Uma plataforma simples para criadores, marcas, profissionais e revendedores gerenciarem campanhas digitais, solicitações e serviços de visibilidade em um só lugar.</p>
      <br>
      <a class="btn" href="/cadastro-teste">Começar agora</a>
      <a class="btn btn-outline" href="#solucoes">Conhecer soluções</a>
    </div>

    <div class="hero-card">
      <h2>O que você encontra</h2>
      <ul>
        <li>Painel prático para gerenciar solicitações</li>
        <li>Soluções para diferentes redes e plataformas</li>
        <li>Acompanhamento de pedidos em tempo real</li>
        <li>Área para clientes e revendedores</li>
        <li>Controle de saldo e histórico</li>
      </ul>
    </div>
  </div>
</section>

<section class="section" id="solucoes">
  <h2>Soluções para presença digital</h2>
  <p class="muted">Ferramentas para quem quer melhorar organização, visibilidade e consistência online.</p>
  <div class="grid">
    <div class="card"><h3>📱 Redes sociais</h3><p class="muted">Recursos para melhorar a presença em plataformas populares.</p></div>
    <div class="card"><h3>📊 Painel centralizado</h3><p class="muted">Gerencie solicitações, saldo e histórico em um único ambiente.</p></div>
    <div class="card"><h3>🤝 Revendedores</h3><p class="muted">Estrutura pensada para quem quer atender seus próprios clientes.</p></div>
  </div>
</section>

<section class="section" id="como-funciona">
  <h2>Como funciona</h2>
  <div class="steps">
    <div class="step"><h3>1</h3><b>Crie sua conta</b><p class="muted">Acesse o painel em poucos segundos.</p></div>
    <div class="step"><h3>2</h3><b>Escolha a solução</b><p class="muted">Selecione a categoria que combina com sua necessidade.</p></div>
    <div class="step"><h3>3</h3><b>Envie os dados</b><p class="muted">Informe o link e a quantidade desejada.</p></div>
    <div class="step"><h3>4</h3><b>Acompanhe</b><p class="muted">Veja tudo pelo painel de pedidos.</p></div>
  </div>
</section>

<section class="section" id="beneficios">
  <h2>Por que usar a Fênix Social?</h2>
  <div class="grid">
    <div class="card"><h3>Ambiente limpo</h3><p class="muted">Design simples, rápido e fácil de usar.</p></div>
    <div class="card"><h3>Controle total</h3><p class="muted">Histórico, saldo, pedidos e status no mesmo lugar.</p></div>
    <div class="card"><h3>Suporte ao crescimento</h3><p class="muted">Ideal para criadores, negócios locais e revendedores.</p></div>
  </div>
</section>

<footer class="footer">
  <b>Fênix Social</b><br>
  Plataforma de soluções digitais para presença online.
</footer>
`));
});

app.get("/login",(req,res)=>{
res.send(layout("Login", `
<div class="login-box">
  <div class="logo">🔥 Fênix <span>Social</span></div>
  <h2>Entrar na plataforma</h2>
  <p class="muted">Acesse sua conta para gerenciar suas solicitações.</p>
  <form method="POST" action="/login">
    <input name="email" placeholder="E-mail" required>
    <input name="senha" type="password" placeholder="Senha" required>
    <button style="width:100%">Entrar</button>
  </form>
  <p class="muted">Conta teste: cliente@teste.com / 123456</p>
</div>
`));
});

app.post("/login",(req,res)=>{
  const user=db.prepare("SELECT * FROM usuarios WHERE email=? AND senha=?").get(req.body.email,req.body.senha);
  if(!user)return res.send("Usuário ou senha inválidos.");
  if(user.tipo==="admin")return res.redirect("/admin");
  res.redirect(`/dashboard?user=${user.id}`);
});

app.get("/cadastro-teste",(req,res)=>{
  try{db.prepare("INSERT INTO usuarios (nome,email,senha,saldo,tipo) VALUES (?,?,?,?,?)").run("Cliente Teste","cliente@teste.com","123456",100,"cliente")}catch{}
  try{db.prepare("INSERT INTO usuarios (nome,email,senha,saldo,tipo) VALUES (?,?,?,?,?)").run("Admin",process.env.ADMIN_EMAIL||"admin@sualoja.com",process.env.ADMIN_PASSWORD||"12345678",0,"admin")}catch{}
  res.redirect("/login");
});

app.get("/dashboard",async(req,res)=>{
  const userId=req.query.user||1;
  const user=db.prepare("SELECT * FROM usuarios WHERE id=?").get(userId);
  const pedidos=db.prepare("SELECT * FROM pedidos WHERE usuario_id=?").all(userId);
  const markup=getMarkup();
  let services=[];
  try{services=await smmRequest("services")}catch{}

  const lista=Array.isArray(services)?services.slice(0,80).map(s=>{
    const venda=Number(s.rate||0)+(Number(s.rate||0)*markup/100);
    return `<tr>
      <td>${s.service}</td><td>${s.name}</td><td>R$ ${venda.toFixed(4)}</td><td>${s.min} - ${s.max}</td>
      <td><form method="POST" action="/pedido">
      <input type="hidden" name="usuario_id" value="${userId}">
      <input type="hidden" name="servico" value="${s.service}">
      <input type="hidden" name="nome_servico" value="${s.name}">
      <input name="link" placeholder="Link" required>
      <input name="quantidade" placeholder="Qtd" required>
      <button>Solicitar</button></form></td></tr>`;
  }).join(""):"";

  res.send(layout("Dashboard", `
<div class="app">${sidebar("dashboard")}
<main class="main">
<h1>Dashboard</h1>
<p class="muted">Bem-vindo(a), ${user?.nome||"Cliente"}.</p>
<div class="cards">
<div class="card"><h3>Saldo</h3><strong>R$ ${(user?.saldo||0).toFixed(2)}</strong></div>
<div class="card"><h3>Pedidos</h3><strong>${pedidos.length}</strong></div>
<div class="card"><h3>Status</h3><strong>Online</strong></div>
<div class="card"><h3>Conta</h3><strong>Cliente</strong></div>
</div>
<div class="card"><h2>Nova solicitação</h2><div class="table-wrap"><table>
<tr><th>ID</th><th>Solução</th><th>Valor</th><th>Limites</th><th>Ação</th></tr>${lista}
</table></div></div>
</main></div>`));
});

app.post("/pedido",async(req,res)=>{
  try{
    const {usuario_id,servico,nome_servico,link,quantidade}=req.body;
    const apiData=await smmRequest("add",{service:servico,link,quantity:quantidade});
    db.prepare("INSERT INTO pedidos (usuario_id,servico,nome_servico,link,quantidade,pedido_api_id) VALUES (?,?,?,?,?,?)")
    .run(usuario_id,servico,nome_servico,link,quantidade,apiData.order||null);
    res.redirect(`/dashboard?user=${usuario_id}`);
  }catch(e){res.send("Erro: "+e.message)}
});

app.get("/admin",(req,res)=>{
  const markup=getMarkup();
  const pedidos=db.prepare("SELECT * FROM pedidos ORDER BY id DESC").all();
  const usuarios=db.prepare("SELECT * FROM usuarios").all();
  res.send(layout("Admin", `<div class="app">${sidebar("admin")}<main class="main">
  <h1>Painel Admin</h1>
  <div class="cards">
  <div class="card"><h3>Usuários</h3><strong>${usuarios.length}</strong></div>
  <div class="card"><h3>Pedidos</h3><strong>${pedidos.length}</strong></div>
  <div class="card"><h3>Markup</h3><strong>${markup}%</strong></div>
  <div class="card"><h3>API</h3><strong>Online</strong></div>
  </div>
  <div class="card"><h2>Percentual de lucro</h2><form method="POST" action="/admin/markup">
  <input name="markup" value="${markup}"><button>Salvar</button></form></div>
  </main></div>`));
});

app.post("/admin/markup",(req,res)=>{
  db.prepare("UPDATE configuracoes SET valor=? WHERE chave=?").run(req.body.markup||100,"markup_percentual");
  res.redirect("/admin");
});

app.get("/services",async(req,res)=>res.json(await smmRequest("services")));
app.get("/balance",async(req,res)=>res.json(await smmRequest("balance")));
app.get("/pedidos",(req,res)=>res.json(db.prepare("SELECT * FROM pedidos").all()));
app.get("/usuarios",(req,res)=>res.json(db.prepare("SELECT * FROM usuarios").all()));

app.listen(PORT,()=>console.log(`Servidor rodando na porta ${PORT}`));
