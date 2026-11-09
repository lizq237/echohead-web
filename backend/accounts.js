'use strict';
const crypto = require('node:crypto');
const { z } = require('zod');
const { parse, HttpError } = require('./validation');
const { hash, transaction, PUBLIC_USER } = require('./auth');
const { passwordHash, verifyPassword } = require('./passwords');
const username = z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,32}$/);
const password = z.string().min(15).max(128);
const signup = z.object({ username, password, nombre: z.string().trim().min(1).max(100) }).strict();
const login = z.object({ username, password: z.string().min(1).max(128) }).strict();
const recover = z.object({ username, password, recovery_code: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict();
const change = z.object({ current_password: z.string().min(1).max(128), password }).strict();
const recoveryCode = () => crypto.randomBytes(32).toString('base64url');
function accounts({ pool, session }) {
  async function throttle(name) {
    // Persistente y atómico: varios IPs no eluden el límite por nombre de cuenta.
    const r = await pool.query(`INSERT INTO echohead_auth_limits(key_hash,attempts,expires_at)
      VALUES($1,1,NOW()+INTERVAL '15 minutes') ON CONFLICT(key_hash) DO UPDATE SET
      attempts=CASE WHEN echohead_auth_limits.expires_at<=NOW() THEN 1 ELSE echohead_auth_limits.attempts+1 END,
      expires_at=CASE WHEN echohead_auth_limits.expires_at<=NOW() THEN NOW()+INTERVAL '15 minutes' ELSE echohead_auth_limits.expires_at END
      RETURNING attempts`, [hash(name)]);
    if (r.rows[0].attempts > 8) throw new HttpError(429, 'Demasiados intentos para esta cuenta. Espera 15 minutos.');
  }
  async function create(req, res, existing = false) {
    const b = parse(signup, req.body);
    await throttle(b.username);
    if (existing && Date.now() - req.authenticatedAt.getTime() > 10 * 60_000) {
      throw new HttpError(403, 'Vuelve a iniciar sesión para configurar tu acceso independiente.');
    }
    const encoded = await passwordHash(b.password), code = recoveryCode();
    const result = await transaction(pool, async client => {
      let user;
      if (existing) {
        user = req.user;
        const prior = await client.query('SELECT user_id FROM echohead_credentials WHERE user_id=$1', [user.id_echohead]);
        if (prior.rowCount) throw new HttpError(409, 'Esta cuenta ya tiene un acceso independiente.');
      } else {
        user = (await client.query(`INSERT INTO users(nombre,foto_perfil) VALUES($1,'') RETURNING ${PUBLIC_USER}`, [b.nombre])).rows[0];
      }
      await client.query('INSERT INTO echohead_credentials(user_id,username,password_hash,recovery_hash) VALUES($1,$2,$3,$4)',
        [user.id_echohead,b.username,encoded,hash(code)]);
      await client.query('DELETE FROM echohead_sessions WHERE user_id=$1', [user.id_echohead]);
      return session.issue(client, req, user);
    });
    session.respond(res, result, { recovery_code: code });
  }
  return {
    register: (req,res) => create(req,res),
    attach: (req,res) => create(req,res,true),
    async login(req,res) {
      const b = parse(login, req.body);
      await throttle(b.username);
      const r = await pool.query(`SELECT c.password_hash,u.id_echohead,u.nombre,u.foto_perfil,u.foto_personalizada_version,u.descripcion,u.created_at
        FROM echohead_credentials c JOIN users u ON u.id_echohead=c.user_id WHERE c.username=$1`, [b.username]);
      const row = r.rows[0];
      if (!await verifyPassword(b.password,row?.password_hash)) throw new HttpError(401,'Usuario o contraseña incorrectos.');
      const { password_hash, ...user } = row;
      const result = await transaction(pool, async client => {
        // No emitir sesión si una recuperación cambió la contraseña durante el cálculo.
        const valid = await client.query('SELECT user_id FROM echohead_credentials WHERE user_id=$1 AND password_hash=$2 FOR UPDATE', [user.id_echohead,password_hash]);
        if (!valid.rowCount) throw new HttpError(401,'Usuario o contraseña incorrectos.');
        await client.query('DELETE FROM echohead_auth_limits WHERE key_hash=$1', [hash(b.username)]);
        return session.issue(client,req,user);
      });
      session.respond(res,result);
    },
    async recover(req,res) {
      const b = parse(recover,req.body);
      await throttle(b.username);
      const encoded = await passwordHash(b.password), code = recoveryCode();
      await transaction(pool, async client => {
        const r = await client.query(`UPDATE echohead_credentials SET password_hash=$1,recovery_hash=$2
          WHERE username=$3 AND recovery_hash=$4 RETURNING user_id`, [encoded,hash(code),b.username,hash(b.recovery_code)]);
        if (!r.rowCount) throw new HttpError(400,'Usuario o clave de recuperación incorrectos.');
        await client.query('DELETE FROM echohead_sessions WHERE user_id=$1',[r.rows[0].user_id]);
        await client.query('DELETE FROM echohead_auth_limits WHERE key_hash=$1',[hash(b.username)]);
      });
      res.json({ recovery_code: code, mensaje:'Contraseña actualizada. Guarda la nueva clave e inicia sesión.' });
    },
    async change(req,res) {
      const b=parse(change,req.body);
      await throttle(`password:${req.user.id_echohead}`);
      const r=await pool.query('SELECT password_hash FROM echohead_credentials WHERE user_id=$1',[req.user.id_echohead]);
      const old=r.rows[0]?.password_hash;
      if (!await verifyPassword(b.current_password,old)) throw new HttpError(400,'Contraseña actual incorrecta.');
      const encoded=await passwordHash(b.password), code=recoveryCode();
      const result=await transaction(pool,async client=>{
        const changed=await client.query('UPDATE echohead_credentials SET password_hash=$1,recovery_hash=$2 WHERE user_id=$3 AND password_hash=$4 RETURNING user_id', [encoded,hash(code),req.user.id_echohead,old]);
        if (!changed.rowCount) throw new HttpError(409,'La cuenta cambió. Vuelve a iniciar sesión.');
        await client.query('DELETE FROM echohead_sessions WHERE user_id=$1',[req.user.id_echohead]);
        await client.query('DELETE FROM echohead_auth_limits WHERE key_hash=$1',[hash(`password:${req.user.id_echohead}`)]);
        return session.issue(client,req,req.user);
      });
      session.respond(res,result,{recovery_code:code});
    },
    async status(req, res) {
  const resultado = await pool.query(
    `SELECT c.username, u.lastfm_username
     FROM users u
     LEFT JOIN echohead_credentials c ON c.user_id = u.id_echohead
     WHERE u.id_echohead = $1`,
    [req.user.id_echohead]
  );

  const cuenta = resultado.rows[0];

  res.json({
    username: cuenta?.username || null,
    lastfm_username: cuenta?.lastfm_username || null,
  });
},
  };
}
module.exports={ accounts };
