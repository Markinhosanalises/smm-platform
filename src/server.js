require('dotenv').config();

const express = require('express');
const session = require('express-session');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');

const db = require('./lib/db');
const { callSmm } = require('./lib/smm');
const { requireAuth, requireAdmin } = require('./lib/auth');

const app = express();

app.set('view engine', 'ejs');
app.set('views', 'views');

app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 }
}));

app.use((req, res, next) => {
  res.locals.user = req.session.user;
  res.locals.money = v => 'R$ ' + Number(v || 0).toFixed(2).replace('.', ',');
  next();
});

try {
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const hasWhatsapp = columns.some(c => c.name === 'whatsapp');

  if (!hasWhatsapp) {
    db.prepare("ALTER TABLE users ADD COLUMN whatsapp TEXT").run();
  }
} catch (e) {
  console.log('Aviso ao verificar coluna whatsapp:', e.message);
}

function calcPrice(service, qty, user) {
  let price = (service.price_per_1000 * qty) / 1000;

  if (user?.reseller) {
    price = price * (1 - (Number(process.env.RESELLER_DISCOUNT_PERCENT || 25) / 100));
  }

  return Math.max(0.01, Number(price.toFixed(2)));
}

function getUserRole(user) {
  const adminEmail = process.env.ADMIN_EMAIL || '';
  if (adminEmail && user.email === adminEmail) return 'admin';
  if (user.role === 'admin') return 'admin';
  return user.role || 'user';
}

app.get('/', (req, res) => {
  const services = db
    .prepare('SELECT * FROM services WHERE active=1 ORDER BY platform, category, name')
    .all();

  res.render('home', { services });
});

app.get('/login', (req, res) => {
  res.render('login', { error: null });
});

app.post('/login', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(req.body.email);

  if (!u || !bcrypt.compareSync(req.body.password, u.password_hash)) {
    return res.render('login', { error: 'E-mail ou senha inválidos' });
  }

  req.session.user = {
    id: u.id,
    name: u.name,
    email: u.email,
    role: getUserRole(u),
    balance: u.balance,
    reseller: u.reseller
  };

  req.session.save(() => {
    res.redirect('/dashboard');
  });
});

app.get('/register', (req, res) => {
  res.render('register', { error: null });
});

app.post('/register', (req, res) => {
  try {
    const { name, email, whatsapp, password, confirm_password } = req.body;

    if (!name || !email || !password) {
      return res.render('register', { error: 'Preencha todos os campos obrigatórios.' });
    }

    if (password.length < 6) {
      return res.render('register', { error: 'A senha precisa ter no mínimo 6 caracteres.' });
    }

    if (confirm_password && password !== confirm_password) {
      return res.render('register', { error: 'As senhas não conferem.' });
    }

    const hash = bcrypt.hashSync(password, 10);

    db.prepare(`
      INSERT INTO users(name, email, whatsapp, password_hash)
      VALUES(?, ?, ?, ?)
    `).run(name, email, whatsapp || '', hash);

    res.redirect('/login');

  } catch (e) {
    res.render('register', { error: 'E-mail já cadastrado ou dados inválidos.' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

app.get('/dashboard', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(req.session.user.id);

  req.session.user = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: getUserRole(user),
    balance: user.balance,
    reseller: user.reseller
  };

  const orders = db.prepare(`
    SELECT o.*, s.name service_name
    FROM orders o
    JOIN services s ON s.id=o.service_id
    WHERE o.user_id=?
    ORDER BY o.id DESC
    LIMIT 30
  `).all(user.id);

  const deposits = db.prepare(`
    SELECT *
    FROM deposits
    WHERE user_id=?
    ORDER BY id DESC
    LIMIT 20
  `).all(user.id);

  const services = db.prepare(`
    SELECT *
    FROM services
    WHERE active=1
    ORDER BY platform, category, name
    LIMIT 60
  `).all();

  res.render('dashboard', {
    orders,
    deposits,
    user: req.session.user,
    services
  });
});

app.post('/deposit', requireAuth, (req, res) => {
  const amount = Number(req.body.amount);

  if (!amount || amount < Number(process.env.MIN_DEPOSIT || 10)) {
    return res.redirect('/dashboard?deposit=low');
  }

  db.prepare(`
    INSERT INTO deposits(user_id, amount, proof)
    VALUES(?, ?, ?)
  `).run(req.session.user.id, amount, req.body.proof || '');

  res.redirect('/dashboard?deposit=ok');
});

app.get('/order/:id', requireAuth, (req, res) => {
  const service = db
    .prepare('SELECT * FROM services WHERE id=? AND active=1')
    .get(req.params.id);

  if (!service) return res.redirect('/dashboard');

  res.render('order', {
    service,
    price: null,
    error: null
  });
});

app.post('/order/:id', requireAuth, async (req, res) => {
  const service = db
    .prepare('SELECT * FROM services WHERE id=? AND active=1')
    .get(req.params.id);

  const user = db
    .prepare('SELECT * FROM users WHERE id=?')
    .get(req.session.user.id);

  if (!service) return res.redirect('/dashboard');

  const qty = Number(req.body.quantity);
  const link = (req.body.link || '').trim();
  const charge = calcPrice(service, qty, user);
  const cost = (service.cost_per_1000 * qty) / 1000;

  if (!link || qty < service.min_qty || qty > service.max_qty) {
    return res.render('order', {
      service,
      price: charge,
      error: 'Confira link e quantidade.'
    });
  }

  if (user.balance < charge) {
    return res.render('order', {
      service,
      price: charge,
      error: 'Saldo insuficiente. Faça uma recarga primeiro.'
    });
  }

  let status = 'processing';
  let provider_order_id = '';
  let error = '';

  try {
    if (!service.provider_service_id) {
      throw new Error('Serviço sem ID do fornecedor. Configure no admin.');
    }

    const data = await callSmm({
      action: 'add',
      service: String(service.provider_service_id),
      link,
      quantity: String(qty)
    });

    provider_order_id = String(data.order || '');
    status = 'sent';

  } catch (e) {
    status = 'manual_review';
    error = e.message;
  }

  const tx = db.transaction(() => {
    db.prepare('UPDATE users SET balance=balance-? WHERE id=?')
      .run(charge, user.id);

    db.prepare(`
      INSERT INTO orders(
        user_id,
        service_id,
        provider_order_id,
        link,
        quantity,
        charge,
        cost_estimate,
        profit_estimate,
        status,
        error
      )
      VALUES(?,?,?,?,?,?,?,?,?,?)
    `).run(
      user.id,
      service.id,
      provider_order_id,
      link,
      qty,
      charge,
      cost,
      charge - cost,
      status,
      error
    );
  });

  tx();

  res.redirect('/dashboard');
});

app.post('/ticket', requireAuth, (req, res) => {
  db.prepare(`
    INSERT INTO tickets(user_id, subject, message)
    VALUES(?, ?, ?)
  `).run(
    req.session.user.id,
    req.body.subject,
    req.body.message
  );

  res.redirect('/dashboard');
});

app.get('/admin', requireAdmin, async (req, res) => {
  const stats = {
    users: db.prepare('SELECT COUNT(*) total FROM users').get().total,
    orders: db.prepare('SELECT COUNT(*) total FROM orders').get().total,
    revenue: db.prepare('SELECT COALESCE(SUM(charge),0) total FROM orders').get().total,
    profit: db.prepare('SELECT COALESCE(SUM(profit_estimate),0) total FROM orders').get().total
  };

  let providerBalance = { balance: 'Indisponível' };

  try {
    providerBalance = await callSmm({ action: 'balance' });
  } catch (e) {
    console.log('Erro SMM:', e.message);
  }

  res.render('admin', {
    stats,
    providerBalance
  });
});

app.get('/admin/services', requireAdmin, (req, res) => {
  res.render('admin_services', {
    services: db.prepare('SELECT * FROM services ORDER BY id DESC').all()
  });
});

app.post('/admin/services', requireAdmin, (req, res) => {
  const b = req.body;

  db.prepare(`
    INSERT INTO services(
      provider_service_id,
      name,
      category,
      platform,
      min_qty,
      max_qty,
      cost_per_1000,
      price_per_1000,
      description,
      active
    )
    VALUES(?,?,?,?,?,?,?,?,?,?)
  `).run(
    b.provider_service_id,
    b.name,
    b.category,
    b.platform,
    b.min_qty,
    b.max_qty,
    b.cost_per_1000,
    b.price_per_1000,
    b.description,
    b.active ? 1 : 0
  );

  res.redirect('/admin/services');
});

app.post('/admin/service/:id', requireAdmin, (req, res) => {
  const b = req.body;

  db.prepare(`
    UPDATE services SET
      provider_service_id=?,
      name=?,
      category=?,
      platform=?,
      min_qty=?,
      max_qty=?,
      cost_per_1000=?,
      price_per_1000=?,
      description=?,
      active=?
    WHERE id=?
  `).run(
    b.provider_service_id,
    b.name,
    b.category,
    b.platform,
    b.min_qty,
    b.max_qty,
    b.cost_per_1000,
    b.price_per_1000,
    b.description,
    b.active ? 1 : 0,
    req.params.id
  );

  res.redirect('/admin/services');
});

app.get('/admin/orders', requireAdmin, (req, res) => {
  const orders = db.prepare(`
    SELECT o.*, u.name user_name, s.name service_name
    FROM orders o
    JOIN users u ON u.id=o.user_id
    JOIN services s ON s.id=o.service_id
    ORDER BY o.id DESC
    LIMIT 200
  `).all();

  res.render('admin_orders', { orders });
});

app.post('/admin/order/:id/status', requireAdmin, (req, res) => {
  db.prepare('UPDATE orders SET status=? WHERE id=?')
    .run(req.body.status, req.params.id);

  res.redirect('/admin/orders');
});

app.get('/admin/deposits', requireAdmin, (req, res) => {
  const deposits = db.prepare(`
    SELECT d.*, u.name user_name, u.email
    FROM deposits d
    JOIN users u ON u.id=d.user_id
    ORDER BY d.id DESC
    LIMIT 200
  `).all();

  res.render('admin_deposits', { deposits });
});

app.post('/admin/deposit/:id/approve', requireAdmin, (req, res) => {
  const d = db.prepare('SELECT * FROM deposits WHERE id=?').get(req.params.id);

  if (d && d.status === 'pending') {
    const tx = db.transaction(() => {
      db.prepare(`
        UPDATE deposits
        SET status="approved", approved_at=CURRENT_TIMESTAMP
        WHERE id=?
      `).run(d.id);

      db.prepare('UPDATE users SET balance=balance+? WHERE id=?')
        .run(d.amount, d.user_id);
    });

    tx();
  }

  res.redirect('/admin/deposits');
});

app.post('/admin/deposit/:id/reject', requireAdmin, (req, res) => {
  db.prepare('UPDATE deposits SET status="rejected" WHERE id=?')
    .run(req.params.id);

  res.redirect('/admin/deposits');
});

app.get('/admin/users', requireAdmin, (req, res) => {
  res.render('admin_users', {
    users: db.prepare('SELECT * FROM users ORDER BY id DESC').all()
  });
});

app.post('/admin/user/:id', requireAdmin, (req, res) => {
  db.prepare(`
    UPDATE users SET role=?, reseller=?, balance=?
    WHERE id=?
  `).run(
    req.body.role,
    req.body.reseller ? 1 : 0,
    Number(req.body.balance || 0),
    req.params.id
  );

  res.redirect('/admin/users');
});
app.get('/virar-admin', requireAuth, (req, res) => {
  db.prepare('UPDATE users SET role=? WHERE id=?')
    .run('admin', req.session.user.id);

  req.session.user.role = 'admin';

  req.session.save(() => {
    res.redirect('/admin');
  });
});
app.listen(process.env.PORT || 3000, () => {
  console.log('SMM Pro rodando na porta ' + (process.env.PORT || 3000));
});
