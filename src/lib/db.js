const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
require('dotenv').config();
const db = new Database('data/app.db');
db.pragma('journal_mode = WAL');
function migrate(){
 db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY AUTOINCREMENT,name TEXT NOT NULL,email TEXT NOT NULL UNIQUE,password_hash TEXT NOT NULL,role TEXT NOT NULL DEFAULT 'client',balance REAL NOT NULL DEFAULT 0,reseller INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS services(id INTEGER PRIMARY KEY AUTOINCREMENT,provider_service_id TEXT,name TEXT NOT NULL,category TEXT NOT NULL,platform TEXT NOT NULL,min_qty INTEGER NOT NULL DEFAULT 10,max_qty INTEGER NOT NULL DEFAULT 10000,cost_per_1000 REAL NOT NULL DEFAULT 0,price_per_1000 REAL NOT NULL,active INTEGER NOT NULL DEFAULT 1,description TEXT DEFAULT '',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,service_id INTEGER NOT NULL,provider_order_id TEXT,link TEXT NOT NULL,quantity INTEGER NOT NULL,charge REAL NOT NULL,cost_estimate REAL NOT NULL DEFAULT 0,profit_estimate REAL NOT NULL DEFAULT 0,status TEXT NOT NULL DEFAULT 'pending',error TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS deposits(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,amount REAL NOT NULL,status TEXT NOT NULL DEFAULT 'pending',proof TEXT,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,approved_at TEXT);
CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY AUTOINCREMENT,user_id INTEGER NOT NULL,subject TEXT NOT NULL,message TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
`);
 const adminEmail=process.env.ADMIN_EMAIL||'admin@sualoja.com';
 if(!db.prepare('SELECT id FROM users WHERE email=?').get(adminEmail)){
  const hash=bcrypt.hashSync(process.env.ADMIN_PASSWORD||'12345678',10);
  db.prepare('INSERT INTO users(name,email,password_hash,role,balance) VALUES(?,?,?,?,?)').run(process.env.ADMIN_NAME||'Admin',adminEmail,hash,'admin',0);
 }
 if(db.prepare('SELECT COUNT(*) total FROM services').get().total===0){
  const i=db.prepare('INSERT INTO services(provider_service_id,name,category,platform,min_qty,max_qty,cost_per_1000,price_per_1000,description) VALUES(?,?,?,?,?,?,?,?,?)');
  i.run('','Seguidores Instagram - Inicial','Seguidores','Instagram',50,10000,8,19.9,'Edite e coloque o ID real do fornecedor.');
  i.run('','Curtidas Instagram - Rápidas','Curtidas','Instagram',50,20000,2,7.9,'Edite e coloque o ID real do fornecedor.');
  i.run('','Visualizações Reels/TikTok','Visualizações','TikTok',100,100000,1.5,5.9,'Edite e coloque o ID real do fornecedor.');
  i.run('','Inscritos YouTube','Inscritos','YouTube',50,5000,18,39.9,'Edite e coloque o ID real do fornecedor.');
 }
}
migrate();
module.exports=db;
