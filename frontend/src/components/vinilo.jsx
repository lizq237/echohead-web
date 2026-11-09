import { useEffect, useState } from 'react';

export const COLORES_VINILO = {
  negro: '#1b1b1b',
  humo: '#9ba09d',
  verde: '#155a36',
  vino: '#5f202b',
};

export const colorValido = color =>
  typeof color === 'string' && /^#[0-9a-f]{6}$/i.test(color);

const paletas = new Map();
const texturas = new Map();

function recordar(cache, clave, valor, limite) {
  cache.set(clave, valor);

  if (cache.size > limite) {
    cache.delete(cache.keys().next().value);
  }

  return valor;
}

function leerColores(src, signal) {
  if (paletas.has(src)) {
    return Promise.resolve(paletas.get(src));
  }

  return new Promise((resolve, reject) => {
    const imagen = new Image();
    let terminado = false;

    const terminar = (error, colores) => {
      if (terminado) return;

      terminado = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', cancelar);

      imagen.onload = null;
      imagen.onerror = null;

      if (error) {
        imagen.src = '';
        reject(error);
      } else {
        resolve(colores);
      }
    };

    const cancelar = () => {
      terminar(new Error('Lectura cancelada'));
    };

    const timer = setTimeout(() => {
      terminar(new Error('Tiempo agotado'));
    }, 8000);

    signal.addEventListener('abort', cancelar, { once: true });

    imagen.crossOrigin = 'anonymous';
    imagen.referrerPolicy = 'no-referrer';

    imagen.onerror = () => {
      terminar(new Error('Portada no disponible'));
    };

    imagen.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 64;
        canvas.height = 64;

        const ctx = canvas.getContext('2d', {
          willReadFrequently: true,
        });

        ctx.drawImage(imagen, 0, 0, 64, 64);

        const { data } = ctx.getImageData(0, 0, 64, 64);
        const grupos = new Map();

        for (let i = 0; i < data.length; i += 4) {
          if (data[i + 3] < 200) continue;

          const [r, g, b] = [
            data[i],
            data[i + 1],
            data[i + 2],
          ];

          const clave = `${r >> 5},${g >> 5},${b >> 5}`;
          const grupo = grupos.get(clave) || [0, 0, 0, 0];

          grupo[0] += r;
          grupo[1] += g;
          grupo[2] += b;
          grupo[3]++;

          grupos.set(clave, grupo);
        }

        const candidatos = [...grupos.values()]
          .sort((a, b) => b[3] - a[3])
          .map(([r, g, b, n]) => [r / n, g / n, b / n]);

        const elegidos = [];

        for (const rgb of candidatos) {
          const diferente = elegidos.every(otro =>
            Math.hypot(
              ...rgb.map((valor, i) => valor - otro[i])
            ) > 65
          );

          if (diferente) {
            elegidos.push(rgb);
          }

          if (elegidos.length === 6) break;
        }

        const colores = elegidos.map(rgb =>
          `#${rgb
            .map(valor =>
              Math.round(valor).toString(16).padStart(2, '0')
            )
            .join('')}`
        );

        if (!colores.length) {
          throw new Error('Sin colores disponibles');
        }

        terminar(
          null,
          recordar(paletas, src, colores, 40)
        );
      } catch (error) {
        terminar(error);
      }
    };

    if (signal.aborted) {
      cancelar();
    } else {
      imagen.src = src;
    }
  });
}

export function usePaletaPortada(src) {
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    if (!src) return;

    const controller = new AbortController();

    leerColores(src, controller.signal).then(
      colores => {
        if (!controller.signal.aborted) {
          setResultado({
            src,
            colores,
            estado: 'lista',
          });
        }
      },
      () => {
        if (!controller.signal.aborted) {
          setResultado({
            src,
            colores: [],
            estado: 'error',
          });
        }
      }
    );

    return () => controller.abort();
  }, [src]);

  if (!src) {
    return { colores: [], estado: 'vacia' };
  }

  if (paletas.has(src)) {
    return {
      colores: paletas.get(src),
      estado: 'lista',
    };
  }

  if (resultado?.src === src) {
    return resultado;
  }

  return { colores: [], estado: 'cargando' };
}

// Textura original: no utiliza ni modifica la portada musical.
export function texturaVinilo(color, acabado) {
  const tono = colorValido(color)
    ? color.toLowerCase()
    : COLORES_VINILO.negro;

  const clave = `${tono}:${acabado}`;

  if (texturas.has(clave)) {
    return texturas.get(clave);
  }

  if (typeof document === 'undefined') return '';

  try {
    const size = 768;
    const canvas = document.createElement('canvas');

    canvas.width = size;
    canvas.height = size;

    const ctx = canvas.getContext('2d');
    const pixels = ctx.createImageData(size, size);

    const rgb = [1, 3, 5].map(i =>
      parseInt(tono.slice(i, i + 2), 16)
    );

    const brillo = acabado === 'mate' ? 0.28 : 1;

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x + 0.5 - size / 2) / (size / 2);
        const dy = (y + 0.5 - size / 2) / (size / 2);
        const r = Math.hypot(dx, dy);

        if (r > 1) continue;

        const angle = Math.atan2(dy, dx);

        const luz = Math.pow(
          Math.max(0, Math.cos(2 * (angle + Math.PI / 4))),
          8
        );

        const surco = Math.sin(r * 900);
        const bandas = 0.98 + Math.sin(r * 64) * 0.015;

        let hash =
          Math.imul(x + 1, 374761393) ^
          Math.imul(y + 1, 668265263);

        hash = Math.imul(
          hash ^ (hash >>> 13),
          1274126177
        );

        const ruido =
          ((hash ^ (hash >>> 16)) >>> 0) / 4294967295 - 0.5;

        const reflejo =
          luz * brillo * (0.4 + surco * 0.025) * bandas;

        const sombra =
          (r > 0.985 ? 0.3 : 0.66) + surco * 0.018;

        const borde =
          r > 0.975 && r < 0.981 ? 0.13 : 0;

        const i = (y * size + x) * 4;

        for (let c = 0; c < 3; c++) {
          pixels.data[i + c] =
            rgb[c] * sombra +
            255 * (reflejo + borde + ruido * 0.012);
        }

        pixels.data[i + 3] = Math.min(
          255,
          (1 - r) * size / 2 * 255
        );
      }
    }

    ctx.putImageData(pixels, 0, 0);

    return recordar(
      texturas,
      clave,
      canvas.toDataURL('image/png'),
      12
    );
  } catch {
    return '';
  }
}