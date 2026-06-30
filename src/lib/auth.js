function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.user) {
    return res.redirect('/login');
  }

  const adminEmail = process.env.ADMIN_EMAIL || '';

  if (req.session.user.role === 'admin') {
    return next();
  }

  if (adminEmail && req.session.user.email === adminEmail) {
    req.session.user.role = 'admin';
    return next();
  }

  return res.status(403).send(`
    <h1>Acesso negado</h1>
    <p>Seu usuário não está como admin.</p>
    <p>Email logado: ${req.session.user.email}</p>
    <p>ADMIN_EMAIL configurado: ${adminEmail}</p>
    <a href="/dashboard">Voltar</a>
  `);
}

module.exports = { requireAuth, requireAdmin };
