'use strict';
const crypto = require('node:crypto');
const { cifrarToken } = require('./spotify-token');
const { HttpError, parse, schemas } = require('./validation');
const random = () => crypto.randomBytes(32).toString('base64url');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const validToken = value => typeof value === 'string' && /^[A-Za-z0-9_-]{43}$/.test(value);
const csrfFor = token => crypto.createHmac('sha256',token).update('echohead-csrf-v2').digest('base64url');
const PUBLIC_USER = 'id_echohead, nombre, foto_perfil, foto_personalizada_version, descripcion, created_at';
async function transaction(pool, work) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
function auth({ pool, spotify, config }) {
  const cookie = { httpOnly:true, secure:config.secureCookies, sameSite:config.sameSite, path:'/' };
  const sessionName = config.secureCookies ? '__Host-echohead_session' : 'echohead_session';
  const oauthName = config.secureCookies ? '__Host-echohead_oauth' : 'echohead_oauth';
  const lifetime = 12 * 3600;
  async function issue(client,req,user) {
    const token=random(), csrf=csrfFor(token);
    const old=req.cookies[sessionName];
    if (validToken(old)) await client.query('DELETE FROM echohead_sessions WHERE token_hash=$1',[hash(old)]);
    await client.query('INSERT INTO echohead_sessions(token_hash,user_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)',
      [hash(token),user.id_echohead,hash(csrf),new Date(Date.now()+lifetime*1000)]);
    return { token, csrf_token:csrf, expires_in:lifetime, user };
  }
  function respond(res,result,extra={}) {
    const {token,...data}=result;
    res.cookie(sessionName,token,{...cookie,maxAge:lifetime*1000});
    res.json({...data,...extra});
  }
  async function begin(req,res,link=false) {
    if (!config.clientId || !config.clientSecret) throw new HttpError(503,'La conexión con Spotify no está configurada.');
    if (link && Date.now()-req.authenticatedAt.getTime()>10*60_000) throw new HttpError(403,'Vuelve a iniciar sesión antes de vincular Spotify.');
    const state=random(),browser=random(),verifier=random();
    await pool.query(`INSERT INTO echohead_oauth_attempts(state_hash,browser_hash,verifier,expires_at,link_user_id,link_session_hash)
      VALUES($1,$2,$3,NOW()+INTERVAL '10 minutes',$4,$5)`,[hash(state),hash(browser),verifier,link?req.user.id_echohead:null,link?req.sessionHash:null]);
    res.cookie(oauthName,browser,{...cookie,maxAge:10*60_000});
    const params=new URLSearchParams({response_type:'code',client_id:config.clientId,redirect_uri:config.redirectUri,
      scope:'user-read-private user-read-email user-top-read user-library-read user-read-currently-playing user-read-playback-state user-modify-playback-state',
      state,code_challenge_method:'S256',code_challenge:crypto.createHash('sha256').update(verifier).digest('base64url')});
    const url=`https://accounts.spotify.com/authorize?${params}`;
    if (link) res.json({url}); else res.redirect(url);
  }
  return {
    sessionName,oauthName,issue,respond,
    login:(req,res)=>begin(req,res), connect:(req,res)=>begin(req,res,true),
    async exchange(req,res) {
      const {code,state}=parse(schemas.exchange,req.body);
      const browser=req.cookies[oauthName];
      if (!validToken(browser)) throw new HttpError(400,'Inicio de sesión vencido. Vuelve a conectar Spotify.');
      const attempt=await pool.query(`DELETE FROM echohead_oauth_attempts WHERE state_hash=$1 AND browser_hash=$2 AND expires_at>NOW()
        RETURNING verifier,link_user_id,link_session_hash`,[hash(state),hash(browser)]);
      if (!attempt.rowCount) throw new HttpError(400,'Inicio de sesión no válido o ya utilizado.');
      res.clearCookie(oauthName,cookie);
      const pending=attempt.rows[0];
      const current=req.cookies[sessionName];
      if (pending.link_user_id && (!validToken(current) || hash(current)!==pending.link_session_hash)) throw new HttpError(401,'La sesión cambió. Vuelve a iniciar la vinculación.');
      let tokens,profile;
      try { tokens=await spotify.exchange(code,pending.verifier); profile=await spotify.profile(tokens.access_token); }
      catch { throw new HttpError(502,'No se pudo conectar Spotify. Comprueba que esta cuenta esté autorizada para la beta. Puedes usar EchoHead sin Spotify.'); }
      if (typeof tokens.access_token!=='string' || !tokens.access_token || !Number.isFinite(tokens.expires_in) || tokens.expires_in<=0 || typeof profile.id!=='string' || !profile.id || profile.id.length>255) throw new HttpError(502,'Respuesta de Spotify no válida.');
      const result=await transaction(pool,async client=>{
        let user;
        if (pending.link_user_id) {
          const live=await client.query('SELECT user_id FROM echohead_sessions WHERE token_hash=$1 AND user_id=$2 AND expires_at>NOW() FOR UPDATE', [pending.link_session_hash,pending.link_user_id]);
          if (!live.rowCount) throw new HttpError(401,'Tu sesión venció. Inicia sesión otra vez.');
          const r=await client.query(`UPDATE users SET spotify_id=$1 WHERE id_echohead=$2 AND (spotify_id IS NULL OR spotify_id=$1) RETURNING ${PUBLIC_USER}`, [profile.id,pending.link_user_id]);
          if (!r.rowCount) throw new HttpError(409,'Tu perfil ya está vinculado a otra cuenta de Spotify.');
          user=r.rows[0];
        } else {
          // Identidad exclusivamente por Spotify ID verificado; nunca por email escrito por el usuario.
          const r=await client.query(`INSERT INTO users(spotify_id,email,nombre,foto_perfil) VALUES($1,$2,$3,$4)
            ON CONFLICT(spotify_id) DO UPDATE SET email=EXCLUDED.email,nombre=EXCLUDED.nombre,foto_perfil=EXCLUDED.foto_perfil
            RETURNING ${PUBLIC_USER}`, [profile.id,typeof profile.email==='string'?profile.email:null,String(profile.display_name||'Oyente').slice(0,100),profile.images?.[0]?.url||'']);
          user=r.rows[0];
        }
        const sesion = await issue(client, req, user);

if (typeof tokens.refresh_token === 'string' && tokens.refresh_token.length > 0) {
  await client.query(
    `UPDATE echohead_sessions
        SET spotify_refresh_token_cifrado = $1
      WHERE token_hash = $2`,
    [cifrarToken(tokens.refresh_token), hash(sesion.token)]
  );
}

return sesion;
      });
      respond(res,result,{access_token:tokens.access_token,spotify_expires_in:Math.min(tokens.expires_in,3600)});
    },
    async restore(req,res) {
      // POST protegido por Origin estricto; no exige CSRF que aún no tiene la pestaña.
      const token=req.cookies[sessionName];
      if (!validToken(token)) throw new HttpError(401,'Inicia sesión para continuar.');
      const r=await pool.query(`SELECT s.csrf_hash,s.expires_at,u.id_echohead,u.nombre,u.foto_perfil,u.foto_personalizada_version,u.descripcion,u.created_at
        FROM echohead_sessions s JOIN users u ON u.id_echohead=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[hash(token)]);
      const row=r.rows[0], csrf=csrfFor(token);
      if (!row || row.csrf_hash!==hash(csrf)) throw new HttpError(401,'Vuelve a iniciar sesión.');
      const {csrf_hash,expires_at,...user}=row;
      res.json({user,csrf_token:csrf,expires_in:Math.max(1,Math.floor((new Date(expires_at).getTime()-Date.now())/1000))});
    },
    async required(req,res,next) {
      const token=req.cookies[sessionName];
      if (!validToken(token)) throw new HttpError(401,'Inicia sesión para continuar.');
      const r=await pool.query(`SELECT s.token_hash,s.csrf_hash,s.authenticated_at,u.id_echohead,u.nombre,u.foto_perfil,u.foto_personalizada_version,u.descripcion,u.created_at
        FROM echohead_sessions s JOIN users u ON u.id_echohead=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW()`,[hash(token)]);
      if (!r.rowCount) throw new HttpError(401,'Tu sesión venció. Vuelve a iniciar sesión.');
      const {token_hash,csrf_hash,authenticated_at,...user}=r.rows[0];
      req.user=user;req.sessionHash=token_hash;req.authenticatedAt=new Date(authenticated_at);
      if (!['GET','HEAD','OPTIONS'].includes(req.method)) {
        const csrf=req.get('X-CSRF-Token');
        if (!validToken(csrf) || !crypto.timingSafeEqual(Buffer.from(hash(csrf),'hex'),Buffer.from(csrf_hash,'hex'))) throw new HttpError(403,'Solicitud no válida. Vuelve a iniciar sesión.');
      }
      next();
    },
    async logout(req,res) {
      await pool.query('DELETE FROM echohead_sessions WHERE token_hash=$1',[req.sessionHash]);
      res.clearCookie(sessionName,cookie);res.clearCookie(oauthName,cookie);res.status(204).end();
    },
  };
}
module.exports={auth,hash,transaction,PUBLIC_USER};
