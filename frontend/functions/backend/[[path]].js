export async function onRequest({ request }) {
  const entrada = new URL(request.url);
  const destino = new URL('https://echohead-web.onrender.com');

  destino.pathname = entrada.pathname.slice('/backend'.length);
  destino.search = entrada.search;

  const peticion = new Request(destino, request);
  return fetch(peticion, { redirect: 'manual' });
}