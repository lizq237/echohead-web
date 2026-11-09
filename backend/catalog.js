'use strict';
const axios = require('axios');
const { z } = require('zod');
const { parse, HttpError } = require('./validation');
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const querySchema=z.object({q:z.string().trim().min(2).max(80),type:z.enum(['album','song','artist']),offset:z.string().regex(/^\d{1,3}$/).default('0').transform(Number).pipe(z.number().max(200))}).strict();
const types={album:['release-group','releasegroup','release-groups','rg'],song:['recording','recording','recordings','rec'],artist:['artist','artist','artists','artist']};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function catalog({musicbrainz,config}) {
  const cache=new Map(), pending=new Map();
  let queue=Promise.resolve(), lastStart=0, blockedUntil=0;
  const http=axios.create({timeout:8000,maxRedirects:0,maxContentLength:2*1024*1024});
  async function fetchData(type,q,offset) {
    const [entity, field] = types[type];

// Los caracteres de búsqueda se tratan como texto literal.
const escapar = valor =>
  valor.replace(/([+\-&|!(){}\[\]^"~*?:\\/])/g, '\\$1');

const texto = q.trim().replace(/\s+/g, ' ');
const frase = escapar(texto);
const palabras = [...new Set(texto.split(' '))];

// Cada palabra puede estar en el título o en el artista.
const combinada = palabras
  .map(palabra => {
    const termino = escapar(palabra);

    return (
      `(${field}:"${termino}" OR artist:"${termino}")`
    );
  })
  .join(' AND ');

// Damos mayor relevancia a la frase completa en el título.
// Conservamos la búsqueda de artistas que ya funciona.
const query = type === 'artist'
  ? `${field}:"${frase}"`
  : `(${field}:"${frase}"^4 OR (${combinada}))`;

const params = {
  query,
  fmt: 'json',
  limit: 20,
  offset,
};
    if (musicbrainz) return musicbrainz.search(entity,params);
    const contact=config.musicbrainzContact;
    if (!contact || !/^(https:\/\/\S+|[^\s@]+@[^\s@]+\.[^\s@]+)$/.test(contact) || /[\r\n]/.test(contact)) throw new HttpError(503,'Falta configurar MUSICBRAINZ_CONTACT en el backend.');
    try {
      const response=await http.get(`https://musicbrainz.org/ws/2/${entity}/`,{params,headers:{'User-Agent':`EchoHead/2.0 (${contact})`,Accept:'application/json'}});
      return response.data;
    } catch(error) {
      if ([429,503].includes(error.response?.status)) {
        const retry=Math.max(10,Math.min(300,Number(error.response.headers['retry-after'])||30));
        blockedUntil=Date.now()+retry*1000;
        throw new HttpError(503,'El catálogo está ocupado. Espera un momento antes de buscar otra vez.');
      }
      throw new HttpError(502,'No pudimos consultar MusicBrainz. Inténtalo de nuevo.');
    }
  }
  async function searchData(type,q,offset) {
    const key=JSON.stringify([type,q.toLowerCase(),offset]);
    const hit=cache.get(key);
    if (hit && hit.expires>Date.now()) return hit.value;
    if (pending.has(key)) return pending.get(key);
    if (pending.size>=5 || blockedUntil>Date.now()) throw new HttpError(503,'Hay varias búsquedas en curso. Inténtalo en unos segundos.');
    const work=queue.then(async()=>{
      if (blockedUntil>Date.now()) throw new HttpError(503,'El catálogo está ocupado. Inténtalo más tarde.');
      await sleep(Math.max(0,1100-(Date.now()-lastStart)));
      lastStart=Date.now();
      const data=await fetchData(type,q,offset);
      const [,,list,prefix]=types[type];
      if (!Array.isArray(data[list])) throw new HttpError(502,'El catálogo devolvió una respuesta inesperada.');
      const items=data[list].filter(x=>UUID.test(x.id)).map(x=>{
        const artist=type==='artist'?x.name:(x['artist-credit']||[]).map(a=>`${a.name||a.artist?.name||''}${a.joinphrase||''}`).join('');
        const release=(x.releases||[]).find(r=>UUID.test(r.id));
        const basePortadas = 'https://coverartarchive.org';
const grupoDelAlbum = release?.['release-group']?.id;

let image = '';

if (type === 'album') {
  image = `${basePortadas}/release-group/${x.id}/front-500`;
} else if (type === 'song' && release) {
  image = grupoDelAlbum
    ? `${basePortadas}/release-group/${grupoDelAlbum}/front-500`
    : `${basePortadas}/release/${release.id}/front-500`;
}
        return {id:`mb:${prefix}:${x.id}`,name:String(x.title||x.name||'Sin título').slice(0,255),artista:String(artist||'Artista desconocido').slice(0,255),image,
          url:`https://musicbrainz.org/${types[type][0]}/${x.id}`,source:'musicbrainz',year:(x['first-release-date']||'').slice(0,4),disambiguation:x.disambiguation||''};
      });
      const value={items,offset,hasMore:offset+20<Math.min(Number(data.count)||0,220),source:'musicbrainz'};
      if(cache.size>=300) cache.delete(cache.keys().next().value);
      cache.set(key,{value,expires:Date.now()+5*60_000});
      return value;
    });
    pending.set(key,work);
    queue=work.catch(()=>{});
    try{return await work;}finally{pending.delete(key);}
  }
  return { search:async(req,res)=>{
    const {q,type,offset}=parse(querySchema,req.query);
    res.json(await searchData(type,q,offset));
  }};
}
module.exports={catalog};
