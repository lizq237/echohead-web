export async function onRequest({ request }) {
  const entrada = new URL(request.url);
  const destino = new URL('https://site--echohead-web--xjky44j4lk8k.code.run');

  destino.pathname = entrada.pathname.slice('/backend'.length);
  destino.search = entrada.search;

  const peticion = new Request(destino, request);
  return fetch(peticion, { redirect: 'manual' });
}