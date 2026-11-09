'use strict';
const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const request = require('supertest');
const { PGlite } = require('@electric-sql/pglite');
const { createApp } = require('../app');
const { configuration } = require('../config');
const { hash } = require('../auth');

const origin = 'http://127.0.0.1:5173';
const config = { frontendOrigin: origin, redirectUri: `${origin}/callback`, clientId: 'test-client', clientSecret: 'test-secret', secureCookies: false, sameSite: 'lax', trustProxy: false };
let db, pool, app, exchanges, logs;
let failInsert = false;
const spotify = {
  async exchange(code, verifier) { exchanges.push({ code, verifier }); return { access_token: 'mock-spotify-access', refresh_token: 'must-never-leak', expires_in: 3600 }; },
  async profile() { return { id: 'spotify-alice', email: 'alice@example.test', display_name: 'Alice', images: [{ url: 'https://i.scdn.co/image/test' }] }; },
};
before(async () => {
  db = new PGlite();
  await db.exec(fs.readFileSync(path.join(__dirname, '../esquema.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../migrations/001_security.sql'), 'utf8'));
  await db.exec(fs.readFileSync(path.join(__dirname, '../migrations/002_independent_accounts.sql'), 'utf8'));
  pool = {
    async query(sql, values) {
      if (failInsert && sql.includes('INSERT INTO top_albumes')) throw new Error('simulated insert failure with secret');
      const r = await db.query(sql, values);
      return { rows: r.rows, rowCount: r.rows.length || r.affectedRows || 0 };
    },
    async connect() { return { query: pool.query, release() {} }; },
  };
});
after(async () => { await db.close(); });
beforeEach(async () => {
  await db.exec('TRUNCATE users RESTART IDENTITY CASCADE; TRUNCATE echohead_oauth_attempts; TRUNCATE echohead_auth_limits;');
  await db.query(`INSERT INTO users(spotify_id,email,nombre) VALUES('spotify-alice','alice@example.test','Alice'),('spotify-bob','bob@example.test','Bob')`);
  exchanges = []; logs = []; failInsert = false;
  app = createApp({ pool, spotify, config, logger: { error: x => logs.push(x) } });
});
async function session(userId = 1, expired = false) {
  const token = crypto.randomBytes(32).toString('base64url');
  const csrf = crypto.randomBytes(32).toString('base64url');
  await pool.query('INSERT INTO echohead_sessions(token_hash,user_id,csrf_hash,expires_at) VALUES($1,$2,$3,$4)',
    [hash(token),userId,hash(csrf),new Date(Date.now() + (expired ? -60000 : 3600000))]);
  return { token, csrf, cookie: `echohead_session=${token}` };
}
function write(method, route, auth, body, csrf = auth.csrf) {
  return request(app)[method](route).set('Origin',origin).set('Cookie',auth.cookie).set('X-CSRF-Token',csrf).send(body);
}
const item = { spotify_id: 'A'.repeat(22), tipo: 'album', nombre: 'Album', artista: 'Artist', imagen_url: 'https://i.scdn.co/image/test',
  es_escuchado: true, es_favorito: false, es_pendiente: false, calificacion: 4.5, descripcion: '' };

test('Todas las rutas de datos requieren sesión, incluidas las lecturas', async () => {
  for (const route of ['/usuarios/1','/usuarios/1/albumes','/api/interacciones/1','/api/perfil/1/canciones','/api/usuarios/buscar?q=Alice','/api/usuarios/1/lista-siguiendo']) {
    await request(app).get(route).expect(401);
  }
  for (const [method,route] of [['put','/usuarios/descripcion'],['put','/usuarios/artistas'],['put','/usuarios/albumes'],['put','/usuarios/canciones'],['post','/usuarios/interacciones'],['post','/api/seguidores'],['delete','/api/seguidores'],['post','/usuarios/sync']]) {
    await request(app)[method](route).set('Origin',origin).send({}).expect(401);
  }
});
test('Una sesión inventada o vencida no da acceso', async () => {
  await request(app).get('/usuarios/1').set('Cookie',`echohead_session=${'A'.repeat(43)}`).expect(401);
  const expired = await session(1,true);
  await request(app).get('/usuarios/1').set('Cookie',expired.cookie).expect(401);
});
test('IDOR: no se pueden editar datos ni seguidores de otro usuario', async () => {
  const a = await session();
  await write('put','/usuarios/descripcion',a,{ id_echohead: 2, nuevaDescripcion: 'hacked' }).expect(403);
  for (const key of ['artistas','albumes','canciones']) await write('put',`/usuarios/${key}`,a,{ id_echohead: 2,[key]: [] }).expect(403);
  await write('post','/usuarios/interacciones',a,{...item,id_echohead:2}).expect(403);
  for (const method of ['post','delete']) await write(method,'/api/seguidores',a,{seguidor_id:2,seguido_id:1}).expect(403);
  const result = await pool.query('SELECT descripcion FROM users WHERE id_echohead=2');
  assert.equal(result.rows[0].descripcion,null);
});
test('CSRF y Origin: rechazar tokens ausentes, erróneos y sitios ajenos', async () => {
  const a = await session(); const body = { nuevaDescripcion: 'valid' };
  await write('put','/usuarios/descripcion',a,body,'').expect(403);
  await write('put','/usuarios/descripcion',a,body,'A'.repeat(43)).expect(403);
  await request(app).put('/usuarios/descripcion').set('Cookie',a.cookie).set('X-CSRF-Token',a.csrf).send(body).expect(403);
  await request(app).put('/usuarios/descripcion').set('Origin','https://evil.test').set('Cookie',a.cookie).set('X-CSRF-Token',a.csrf).send(body).expect(403);
  await request(app).options('/usuarios/descripcion').set('Origin','https://evil.test').expect(403);
});
test('Inicio OAuth: state vinculado al navegador, PKCE S256 y consumo único', async () => {
  const login = await request(app).get('/login').expect(302);
  const url = new URL(login.headers.location);
  assert.equal(url.searchParams.get('code_challenge_method'),'S256');
  assert.equal(url.searchParams.get('redirect_uri'),config.redirectUri);
  const state = url.searchParams.get('state');
  const cookie = login.headers['set-cookie'][0].split(';')[0];
  const body = { code: 'test-code',state };
  await request(app).post('/intercambiar-token').set('Origin',origin).send(body).expect(400);
  await request(app).post('/intercambiar-token').set('Origin',origin).set('Cookie',cookie).send({...body,state:'B'.repeat(43)}).expect(400);
  assert.equal(exchanges.length,0);
  const [one,two] = await Promise.all([1,2].map(() => request(app).post('/intercambiar-token').set('Origin',origin).set('Cookie',cookie).send(body)));
  assert.deepEqual([one.status,two.status].sort(),[200,400]);
  const success = one.status === 200 ? one : two;
  assert.equal(exchanges.length,1);
  assert.equal(crypto.createHash('sha256').update(exchanges[0].verifier).digest('base64url'),url.searchParams.get('code_challenge'));
  assert.equal(success.body.user.id_echohead,1);
  assert.equal(success.body.refresh_token,undefined);
  assert.equal(success.body.user.email,undefined);
  assert.match(success.headers['set-cookie'].join(';'),/HttpOnly/);
  assert.equal(success.headers['cache-control'],'no-store');
});
test('OAuth vencido no contacta Spotify y cookie pública tiene Secure y prefijo __Host', async () => {
  app = createApp({pool,spotify,config:{...config,secureCookies:true},logger:{error(){}}});
  const login = await request(app).get('/login').expect(302);
  assert.match(login.headers['set-cookie'][0],/^__Host-echohead_oauth=/);
  assert.match(login.headers['set-cookie'][0],/; Secure/);
  assert.doesNotMatch(login.headers['set-cookie'][0],/Domain=/);
  await pool.query("UPDATE echohead_oauth_attempts SET expires_at=NOW()-INTERVAL '1 minute'");
  await request(app).post('/intercambiar-token').set('Origin',origin).set('Cookie',login.headers['set-cookie'][0].split(';')[0])
    .send({code:'code',state:new URL(login.headers.location).searchParams.get('state')}).expect(400);
  assert.equal(exchanges.length,0);
});
test('Sync no acepta suplantar la identidad; perfiles no exponen email ni spotify_id', async () => {
  const a=await session();
  await write('post','/usuarios/sync',a,{spotify_id:'spotify-bob',nombre:'Impostor'}).expect(400);
  const sync=await write('post','/usuarios/sync',a,{}).expect(200);
  assert.equal(sync.body.id_echohead,1);
  const user=await request(app).get('/usuarios/2').set('Cookie',a.cookie).expect(200);
  assert.deepEqual(Object.keys(user.body).sort(),['id_echohead','nombre','foto_perfil','descripcion','created_at'].sort());
});
test('Inyección SQL se guarda como texto; los IDs y consultas repetidas se validan', async () => {
  const a=await session();
  const injection="'); DROP TABLE users; --";
  await write('put','/usuarios/descripcion',a,{nuevaDescripcion:injection}).expect(200);
  const result=await pool.query('SELECT descripcion FROM users WHERE id_echohead=1');
  assert.equal(result.rows[0].descripcion,injection);
  await request(app).get('/usuarios/1%20OR%201=1').set('Cookie',a.cookie).expect(400);
  await request(app).get('/api/usuarios/buscar?q=a&q=b').set('Cookie',a.cookie).expect(400);
  const search=await request(app).get('/api/usuarios/buscar').query({q:injection}).set('Cookie',a.cookie).expect(200);
  assert.deepEqual(search.body,[]);
  const wildcards=await request(app).get('/api/usuarios/buscar').query({q:'%%'}).set('Cookie',a.cookie).expect(200);
  assert.deepEqual(wildcards.body,[]);
});
test('Validación estricta de tipos, tamaños, IDs, imágenes y asignación masiva', async () => {
  const a=await session();
  for (const changes of [
    {calificacion:9},{calificacion:3.3},{es_favorito:'true'},{tipo:'admin'},
    {spotify_id:"' OR 1=1"},{descripcion:'x'.repeat(5001)},
    {imagen_url:'javascript:alert(1)'},{imagen_url:'http://127.0.0.1/private'},
    {imagen_url:'https://i.scdn.co.evil.test/x'}, {imagen_url:'https://user:pw@i.scdn.co/x'},
    {admin:true},
  ]) await write('post','/usuarios/interacciones',a,{...item,...changes}).expect(400);
  await write('put','/usuarios/descripcion',a,{nuevaDescripcion:'x'.repeat(256)}).expect(400);
  await write('put','/usuarios/albumes',a,{albumes:Array(6).fill({id:'A'.repeat(22),albumName:'x',albumImg:''})}).expect(400);
  await write('post','/api/seguidores',a,{seguido_id:1}).expect(400);
  assert.equal((await pool.query('SELECT * FROM interacciones')).rowCount,0);
});
test('Reseñas con etiquetas se tratan como texto JSON, no se ejecutan como HTML', async () => {
  const a=await session(); const text='<script>alert("x")</script>';
  await write('post','/usuarios/interacciones',a,{...item,descripcion:text}).expect(200);
  const res=await request(app).get('/api/interacciones/1').set('Cookie',a.cookie).expect(200);
  assert.match(res.headers['content-type'],/application\/json/);
  assert.equal(res.headers['x-content-type-options'],'nosniff');
  assert.equal(res.body[0].descripcion,text);
});
test('Reemplazo transaccional: si falla INSERT, conserva favoritos previos', async () => {
  const a=await session();
  await pool.query('INSERT INTO top_albumes(user_id,album_spotify_id,album_name,album_img) VALUES($1,$2,$3,$4)',[1,'B'.repeat(22),'Original','']);
  failInsert=true;
  const res=await write('put','/usuarios/albumes',a,{albumes:[{id:'A'.repeat(22),albumName:'Nuevo',albumImg:''}]}).expect(500);
  failInsert=false;
  assert.equal((await pool.query('SELECT album_name FROM top_albumes WHERE user_id=1')).rows[0].album_name,'Original');
  assert.doesNotMatch(JSON.stringify(res.body)+JSON.stringify(logs),/secret|INSERT|simulated/);
});
test('Flujo permitido: editar, calificar, seguir/dejar de seguir y corregir pendientes', async () => {
  const a=await session();
  await write('put','/usuarios/descripcion',a,{id_echohead:1,nuevaDescripcion:'Hola'}).expect(200);
  await write('post','/usuarios/interacciones',a,{...item,es_favorito:true}).expect(200);
  await write('post','/api/seguidores',a,{seguidor_id:1,seguido_id:2}).expect(200);
  const following=await request(app).get('/api/usuarios/1/siguiendo').set('Cookie',a.cookie).expect(200);
  assert.deepEqual(following.body,[2]);
  await write('delete','/api/seguidores',a,{seguido_id:2}).expect(200);
  await write('put','/usuarios/canciones',a,{canciones:[{id:'C'.repeat(22),cancionName:'Song',cancionImg:''}]}).expect(200);
  await write('post','/usuarios/interacciones',a,{...item,spotify_id:'C'.repeat(22),tipo:'song',es_escuchado:false,es_pendiente:true,calificacion:0}).expect(200);
  const songs=await request(app).get('/api/perfil/1/canciones').set('Cookie',a.cookie).expect(200);
  assert.equal(songs.body[0].es_pendiente,true);
  assert.equal(songs.body[0].es_escuchado,false);
  const album=await request(app).get('/api/interacciones/1').set('Cookie',a.cookie).expect(200);
  assert.equal(album.body[0].artista,'Artist');
});
test('Logout revoca la sesión del servidor, no solo el estado de React', async () => {
  const a=await session();
  await write('post','/auth/logout',a,{}).expect(204);
  await request(app).get('/usuarios/1').set('Cookie',a.cookie).expect(401);
});
test('JSON malformado, cuerpo grande y tipo de contenido incorrecto se rechazan', async () => {
  await request(app).post('/usuarios/interacciones').set('Origin',origin).set('Content-Type','application/json').send('{').expect(400);
  await request(app).post('/usuarios/interacciones').set('Origin',origin).send({text:'x'.repeat(40000)}).expect(413);
  await request(app).post('/usuarios/interacciones').set('Origin',origin).type('form').send('x=y').expect(415);
});
test('Rate limiting devuelve 429 y Retry-After sin consultar credenciales', async () => {
  app=createApp({pool,spotify,config,limits:{global:2},logger:{error(){}}});
  await request(app).get('/health').expect(200);
  await request(app).get('/health').expect(200);
  const res=await request(app).get('/health').expect(429);
  assert.ok(res.headers['retry-after']);
});
test('Configuración insegura falla al arrancar', () => {
  const env={FRONTEND_ORIGIN:origin,REDIRECT_URI:`${origin}/callback`,SPOTIFY_CLIENT_ID:'x',SPOTIFY_CLIENT_SECRET:'y',COOKIE_SECURE:'false'};
  assert.equal(configuration(env).secureCookies,false);
  assert.throws(()=>configuration({...env,NODE_ENV:'production'}));
  assert.throws(()=>configuration({...env,REDIRECT_URI:'https://evil.test/callback'}));
  assert.throws(()=>configuration({...env,TRUST_PROXY:'true'}));
  assert.throws(()=>configuration({...env,COOKIE_SAMESITE:'none'}));
});

test('Volver a iniciar sesión rota el identificador y revoca la cookie anterior', async () => {
  const old = await session();
  const login = await request(app).get('/login').expect(302);
  const oauthCookie = login.headers['set-cookie'][0].split(';')[0];
  const result = await request(app).post('/intercambiar-token').set('Origin',origin)
    .set('Cookie',`${old.cookie}; ${oauthCookie}`).send({code:'code',state:new URL(login.headers.location).searchParams.get('state')}).expect(200);
  await request(app).get('/usuarios/1').set('Cookie',old.cookie).expect(401);
  const newCookie = result.headers['set-cookie'].find(c=>c.startsWith('echohead_session=')).split(';')[0];
  assert.notEqual(newCookie,old.cookie);
  await request(app).get('/usuarios/1').set('Cookie',newCookie).expect(200);
  assert.equal((await pool.query('SELECT * FROM echohead_sessions')).rowCount,1);
});

test('Los límites de escritura y OAuth también rechazan solicitudes excesivas', async () => {
  app=createApp({pool,spotify,config,limits:{write:1,login:1},logger:{error(){}}});
  const a=await session();
  await write('put','/usuarios/descripcion',a,{nuevaDescripcion:'Una'}).expect(200);
  await write('put','/usuarios/descripcion',a,{nuevaDescripcion:'Dos'}).expect(429);
  await request(app).get('/login').expect(302);
  await request(app).get('/login').expect(429);
});

test('Propiedades de prototipo y cabeceras IP falsificadas no eluden los controles', async () => {
  const a=await session();
  await request(app).put('/usuarios/descripcion').set('Origin',origin).set('Cookie',a.cookie)
    .set('X-CSRF-Token',a.csrf).set('Content-Type','application/json')
    .send('{"nuevaDescripcion":"x","__proto__":{"admin":true}}').expect(400);
  assert.equal({}.admin,undefined);
  app=createApp({pool,spotify,config,limits:{global:1},logger:{error(){}}});
  await request(app).get('/health').set('X-Forwarded-For','203.0.113.1').expect(200);
  await request(app).get('/health').set('X-Forwarded-For','203.0.113.2').expect(429);
});

const credentials = {username:'nuevo_oyente',nombre:'Nueva oyente',password:'Una frase bastante larga 2026'};
function credentialPost(path,body,cookie) {
  const call=request(app).post(path).set('Origin',origin);
  if(cookie) call.set('Cookie',cookie);
  return call.send(body);
}
function responseSession(res) {
  return {cookie:res.headers['set-cookie'].find(c=>c.startsWith('echohead_session=')).split(';')[0],csrf:res.body.csrf_token};
}
test('Registro sin Spotify: hash fuerte, cookie HttpOnly y restauración sin exponer secretos',async()=>{
  app=createApp({pool,spotify,config:{...config,clientId:'',clientSecret:''}});
  const created=await credentialPost('/auth/register',credentials).expect(200);
  assert.equal(created.body.access_token,undefined);
  assert.equal(created.body.user.nombre,credentials.nombre);
  assert.match(created.body.recovery_code,/^[A-Za-z0-9_-]{43}$/);
  const a=responseSession(created);
  const row=(await pool.query('SELECT * FROM echohead_credentials')).rows[0];
  assert.match(row.password_hash,/^scrypt-v1\$/);
  assert.notEqual(row.recovery_hash,created.body.recovery_code);
  assert.equal(JSON.stringify(row).includes(credentials.password),false);
  assert.match(created.headers['set-cookie'][0],/HttpOnly/);
  const restored=await credentialPost('/auth/restore',{},a.cookie).expect(200);
  assert.equal(restored.body.csrf_token,a.csrf);
  assert.equal(restored.body.user.id_echohead,created.body.user.id_echohead);
  await write('put','/usuarios/descripcion',a,{nuevaDescripcion:'Independiente'}).expect(200);
  await request(app).get('/login').expect(503);
});
test('Login propio: contraseña incorrecta, mayúsculas y rotación de sesión',async()=>{
  const created=await credentialPost('/auth/register',credentials).expect(200);
  const old=responseSession(created);
  await credentialPost('/auth/login',{username:credentials.username,password:'incorrecta'}).expect(401);
  const login=await credentialPost('/auth/login',{username:'NUEVO_OYENTE',password:credentials.password},old.cookie).expect(200);
  await request(app).get('/auth/me').set('Cookie',old.cookie).expect(401);
  assert.equal(login.body.user.id_echohead,created.body.user.id_echohead);
  assert.equal(login.body.recovery_code,undefined);
});
test('Registro validado, campos extra rechazados y duplicado no deja un perfil huérfano',async()=>{
  for(const changes of [{password:'corta'},{username:'a b'},{username:'aa'},{admin:true},{email:'alice@example.test'}]) {
    await credentialPost('/auth/register',{...credentials,...changes}).expect(400);
  }
  await credentialPost('/auth/register',credentials).expect(200);
  await credentialPost('/auth/register',credentials).expect(409);
  assert.equal((await pool.query('SELECT id_echohead FROM users')).rowCount,3);
});
test('Añadir credenciales al perfil Spotify mantiene su ID, reseñas y favoritos',async()=>{
  const a=await session(1);
  await write('post','/usuarios/interacciones',a,{...item,es_favorito:true,es_pendiente:true,descripcion:'Conservar'}).expect(200);
  await write('post','/auth/credentials',a,{...credentials,id_echohead:2}).expect(400);
  const result=await write('post','/auth/credentials',a,credentials).expect(200);
  assert.equal(result.body.user.id_echohead,1);
  assert.equal((await pool.query('SELECT * FROM users')).rowCount,2);
  const row=(await pool.query('SELECT * FROM interacciones WHERE id_echohead=1')).rows[0];
  assert.equal(row.descripcion,'Conservar');assert.equal(row.es_favorito,true);assert.equal(row.es_pendiente,true);
  await request(app).get('/auth/me').set('Cookie',a.cookie).expect(401);
  await write('post','/auth/credentials',responseSession(result),credentials).expect(409);
});
test('Configurar credenciales requiere sesión reciente y CSRF',async()=>{
  const a=await session();
  await write('post','/auth/credentials',a,credentials,'').expect(403);
  await pool.query("UPDATE echohead_sessions SET authenticated_at=NOW()-INTERVAL '11 minutes'");
  await write('post','/auth/credentials',a,credentials).expect(403);
});
test('Recuperación consume clave una sola vez, cambia contraseña y revoca sesiones',async()=>{
  const created=await credentialPost('/auth/register',credentials).expect(200);
  const a=responseSession(created), next='Otra frase de contraseña segura';
  const body={username:credentials.username,password:next,recovery_code:created.body.recovery_code};
  const recovered=await credentialPost('/auth/recover',body).expect(200);
  assert.notEqual(recovered.body.recovery_code,body.recovery_code);
  await credentialPost('/auth/restore',{},a.cookie).expect(401);
  await credentialPost('/auth/recover',body).expect(400);
  await credentialPost('/auth/login',{username:credentials.username,password:credentials.password}).expect(401);
  await credentialPost('/auth/login',{username:credentials.username,password:next}).expect(200);
});
test('Cambio de contraseña exige la actual, revoca otras sesiones y rota recuperación',async()=>{
  const created=await credentialPost('/auth/register',credentials).expect(200);
  const a=responseSession(created);
  const other=await credentialPost('/auth/login',{username:credentials.username,password:credentials.password}).expect(200);
  await write('post','/auth/password',a,{current_password:'incorrecta',password:'Una nueva contraseña extensa'}).expect(400);
  const result=await write('post','/auth/password',a,{current_password:credentials.password,password:'Una nueva contraseña extensa'}).expect(200);
  assert.notEqual(result.body.recovery_code,created.body.recovery_code);
  await credentialPost('/auth/restore',{},responseSession(other).cookie).expect(401);
  await credentialPost('/auth/restore',{},responseSession(result).cookie).expect(200);
});
test('Límite persistente por cuenta y rutas de acceso rechazan Origin ajeno',async()=>{
  for(const path of ['/auth/register','/auth/login','/auth/recover','/auth/restore']) {
    await request(app).post(path).set('Origin','https://evil.test').send(credentials).expect(403);
    await request(app).post(path).send(credentials).expect(403);
  }
  await pool.query("INSERT INTO echohead_auth_limits(key_hash,attempts,expires_at) VALUES($1,8,NOW()+INTERVAL '15 minutes')",[hash(credentials.username)]);
  await credentialPost('/auth/login',{username:credentials.username,password:credentials.password}).expect(429);
});
test('Spotify puede vincularse solo a la sesión que inició el flujo, sin cambiar de perfil',async()=>{
  const created=await credentialPost('/auth/register',credentials).expect(200);
  const a=responseSession(created);
  const connect=await write('post','/auth/spotify/connect',a,{}).expect(200);
  const state=new URL(connect.body.url).searchParams.get('state');
  const oauth=connect.headers['set-cookie'][0].split(';')[0];
  const uniqueSpotify={...spotify,async profile(){return {id:'spotify-new',display_name:'Otro nombre',email:'unique@example.test'}}};
  app=createApp({pool,spotify:uniqueSpotify,config});
  const result=await credentialPost('/intercambiar-token',{code:'code',state},`${a.cookie}; ${oauth}`).expect(200);
  assert.equal(result.body.user.id_echohead,created.body.user.id_echohead);
  assert.equal(result.body.user.nombre,credentials.nombre);
  assert.equal((await pool.query('SELECT * FROM users')).rowCount,3);
  const reconnect=await write('post','/auth/spotify/connect',responseSession(result),{}).expect(200);
  await credentialPost('/intercambiar-token',{code:'code',state:new URL(reconnect.body.url).searchParams.get('state')},reconnect.headers['set-cookie'][0].split(';')[0]).expect(401);
});
test('No fusiona un perfil Spotify existente con otra cuenta EchoHead',async()=>{
  const created=await credentialPost('/auth/register',credentials).expect(200), a=responseSession(created);
  const link=await write('post','/auth/spotify/connect',a,{}).expect(200);
  await credentialPost('/intercambiar-token',{code:'code',state:new URL(link.body.url).searchParams.get('state')},`${a.cookie}; ${link.headers['set-cookie'][0].split(';')[0]}`).expect(409);
  assert.equal((await pool.query('SELECT spotify_id FROM users WHERE id_echohead=$1',[created.body.user.id_echohead])).rows[0].spotify_id,null);
  await credentialPost('/auth/restore',{},a.cookie).expect(200);
});
const mbid='3bd76d40-7f0e-36b7-9348-91a33afee20e';
test('Catálogo autenticado, caché y escape de consultas; no envía tokens de usuarios',async()=>{
  const calls=[];
  app=createApp({pool,spotify,config,musicbrainz:{async search(entity,params){calls.push({entity,params});return {'release-groups':[{id:mbid,title:'OK Computer','artist-credit':[{name:'Radiohead'}]}],count:1}}}});
  await request(app).get('/catalog/search?q=OK&type=album').expect(401);
  const a=await session();
  const path='/catalog/search?type=album&q=OK%20Computer';
  const results=await Promise.all([1,2].map(()=>request(app).get(path).set('Cookie',a.cookie).expect(200)));
  assert.equal(calls.length,1);
  assert.equal(calls[0].params.query,'releasegroup:"OK Computer"');
  assert.equal(results[0].body.items[0].id,`mb:rg:${mbid}`);
  assert.equal(results[0].body.items[0].image,`https://coverartarchive.org/release-group/${mbid}/front-500`);
  await request(app).get('/catalog/search?q=x&type=album').set('Cookie',a.cookie).expect(400);
  await request(app).get('/catalog/search?q=OK&type=album&offset=999').set('Cookie',a.cookie).expect(400);
  await request(app).get('/catalog/search?q=OK&type=album&url=http://127.0.0.1').set('Cookie',a.cookie).expect(400);
  await request(app).get('/catalog/search').query({q:'x" OR artist:*',type:'album'}).set('Cookie',a.cookie).expect(200);
  assert.equal(calls[1].params.query,'releasegroup:"x\\" OR artist\\:\\*"');
});
test('MusicBrainz: favoritos, pendientes y reseñas conviven con IDs Spotify',async()=>{
  const a=await session();
  await write('post','/usuarios/interacciones',a,item).expect(200);
  const mb={...item,spotify_id:`mb:rg:${mbid}`,imagen_url:`https://coverartarchive.org/release-group/${mbid}/front-500`,es_pendiente:true,descripcion:'Mi reseña'};
  await write('post','/usuarios/interacciones',a,mb).expect(200);
  await write('put','/usuarios/albumes',a,{albumes:[{id:mb.spotify_id,albumName:'OK Computer',albumImg:mb.imagen_url}]}).expect(200);
  const profile=await request(app).get('/api/perfil/1/albumes').set('Cookie',a.cookie).expect(200);
  assert.equal(profile.body[0].calificacion,4.5);assert.equal(profile.body[0].es_pendiente,true);
  assert.equal((await pool.query('SELECT * FROM interacciones')).rowCount,2);
  for(const changes of [{tipo:'song'},{spotify_id:`mb:artist:${mbid}`},{imagen_url:`https://coverartarchive.org.evil.test/release/${mbid}/front-500`},{imagen_url:'https://coverartarchive.org/private?url=http://localhost'}]) {
    await write('post','/usuarios/interacciones',a,{...mb,...changes}).expect(400);
  }
});
test('Migración 002 puede repetirse sin borrar los datos existentes',async()=>{
  const a=await session();await write('post','/usuarios/interacciones',a,item).expect(200);
  await db.exec(fs.readFileSync(path.join(__dirname,'../migrations/002_independent_accounts.sql'),'utf8'));
  assert.equal((await pool.query('SELECT * FROM users')).rowCount,2);
  assert.equal((await pool.query('SELECT * FROM interacciones')).rowCount,1);
});
