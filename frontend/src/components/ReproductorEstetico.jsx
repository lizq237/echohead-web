import {
  createElement,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import html2canvas from 'html2canvas';

import {
  FiCheck,
  FiDownload,
  FiHeart,
  FiMusic,
  FiSettings,
  FiShare2,
  FiStar,
  FiX,
  FiZap,
} from 'react-icons/fi';

import {
  IoPauseSharp,
  IoPlaySharp,
  IoPlaySkipBackSharp,
  IoPlaySkipForwardSharp,
} from 'react-icons/io5';

import { API_BASE_URL, apiFetch } from '../lib/api';

import {
  COLORES_VINILO,
  colorValido,
  texturaVinilo,
  usePaletaPortada,
} from './vinilo';

import './ReproductorEstetico.scss';

const BASES = [
  ['madera', 'Madera'],
  ['claro', 'Claro'],
  ['oscuro', 'Oscuro'],
];

const VINILOS = [
  ['negro', 'Negro'],
  ['humo', 'Humo'],
  ['verde', 'Verde'],
  ['vino', 'Vino'],
];

const ACENTOS = [
  ['verde', '#1db954'],
  ['grafito', '#575757'],
  ['marfil', '#e9e9e9'],
];

const STICKERS = [
  { id: 'estrella', nombre: 'Estrella', Icono: FiStar },
  { id: 'rayo', nombre: 'Rayo', Icono: FiZap },
  { id: 'corazon', nombre: 'Corazón', Icono: FiHeart },
  { id: 'musica', nombre: 'Nota musical', Icono: FiMusic },
];

const PORTADA_VACIA = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 240"><rect width="240" height="240" fill="#1db954"/><path d="M120 25a95 95 0 1 0 0 190h70v-65h-70a30 30 0 1 1 0-60h70V25z" fill="#2d2d2d"/></svg>'
)}`;

function portadaAlternativa(event) {
  if (event.currentTarget.src !== PORTADA_VACIA) {
    event.currentTarget.src = PORTADA_VACIA;
  }
}

function valoresIniciales(nombre) {
  return {
    base: 'madera',
    cancionFavoritaId: '',
    vinilo: 'negro',
    colorVinilo: '#1b1b1b',
    modoColor: 'manual',
    acabado: 'brillante',
    acento: 'verde',
    placa: `${String(nombre || 'MI ESPACIO')
      .slice(0, 16)
      .toUpperCase()} — 01`,
    stickers: ['estrella', 'musica'],
  };
}

function leerDiseno(clave, nombre) {
  const inicial = valoresIniciales(nombre);

  try {
    const data = JSON.parse(localStorage.getItem(clave));

    if (!data || data.version !== 1) return inicial;

    const vinilo = VINILOS.some(([id]) => id === data.vinilo)
      ? data.vinilo
      : inicial.vinilo;

    return {
      base: BASES.some(([id]) => id === data.base)
        ? data.base
        : inicial.base,

      cancionFavoritaId:
        typeof data.cancionFavoritaId === 'string'
          ? data.cancionFavoritaId.slice(0, 200)
          : '',

      vinilo,

      colorVinilo: colorValido(data.colorVinilo)
        ? data.colorVinilo.toLowerCase()
        : COLORES_VINILO[vinilo] || inicial.colorVinilo,

      modoColor:
        data.modoColor === 'auto' ? 'auto' : 'manual',

      acabado:
        data.acabado === 'mate' ? 'mate' : 'brillante',

      acento: ACENTOS.some(([id]) => id === data.acento)
        ? data.acento
        : inicial.acento,

      placa:
        typeof data.placa === 'string'
          ? data.placa.slice(0, 24)
          : inicial.placa,

      stickers: Array.isArray(data.stickers)
        ? STICKERS
            .filter(sticker => data.stickers.includes(sticker.id))
            .map(sticker => sticker.id)
        : inicial.stickers,
    };
  } catch {
    return inicial;
  }
}

// Solo consulta las favoritas cuando se usa el modo decorativo.
function useCancionesFavoritas(activo) {
  const [canciones, setCanciones] = useState([]);
  const [cargando, setCargando] = useState(activo);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);

  useEffect(() => {
    if (!activo) {
      setCanciones([]);
      setCargando(false);
      setError('');
      return;
    }

    const controller = new AbortController();
    let vigente = true;

    const timeout = window.setTimeout(() => {
      controller.abort();
    }, 20000);

    async function cargar() {
      setCargando(true);
      setError('');
      setCanciones([]);

      try {
        const sesion = await apiFetch(
          `${API_BASE_URL}/auth/me`,
          { signal: controller.signal }
        );

        if (!sesion.ok) {
          throw new Error('No pudimos consultar tu cuenta.');
        }

        const usuario = await sesion.json();

        if (!usuario?.id_echohead) {
          throw new Error('No pudimos identificar tu perfil.');
        }

        const respuesta = await apiFetch(
          `${API_BASE_URL}/api/perfil/${
            encodeURIComponent(usuario.id_echohead)
          }/canciones`,
          { signal: controller.signal }
        );

        if (!respuesta.ok) {
          throw new Error(
            'No pudimos cargar tus canciones favoritas.'
          );
        }

        const datos = await respuesta.json();

        if (!Array.isArray(datos)) {
          throw new Error(
            'La respuesta de canciones no es válida.'
          );
        }

        const lista = datos
          .filter(item =>
            item &&
            item.id != null &&
            typeof item.cancionName === 'string' &&
            item.cancionName.trim()
          )
          .map(item => ({
            id: String(item.id),
            nombre: item.cancionName,
            imagen:
              typeof item.cancionImg === 'string'
                ? item.cancionImg
                : '',
          }));

        const unicas = [
          ...new Map(
            lista.map(cancion => [cancion.id, cancion])
          ).values(),
        ];

        if (vigente) {
          setCanciones(unicas);
        }
      } catch (err) {
        if (vigente) {
          setError(
            controller.signal.aborted
              ? 'La consulta tardó demasiado. Inténtalo de nuevo.'
              : err.message || 'No pudimos cargar tus favoritas.'
          );
        }
      } finally {
        window.clearTimeout(timeout);

        if (vigente) {
          setCargando(false);
        }
      }
    }

    cargar();

    return () => {
      vigente = false;
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [activo, intento]);

  return {
    canciones,
    cargando,
    error,
    reintentar: () => setIntento(value => value + 1),
  };
}

function Marca() {
  return (
    <span className="ett-brand" aria-label="EchoHead">
      <svg viewBox="0 0 96 96" aria-hidden="true">
        <path
          fill="currentColor"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M48 5C24.25 5 5 24.25 5 48s19.25 43 43 43h37V58H48c-5.52 0-10-4.48-10-10s4.48-10 10-10h37V5H48Zm0 16c-14.91 0-27 12.09-27 27s12.09 27 27 27h21v-7H48c-11.05 0-20-8.95-20-20s8.95-20 20-20h21v-7H48Z"
        />
        <path fill="#1db954" d="M69 38h16v20H69z" />
      </svg>

      <span>
        echo<em>head</em>
      </span>
    </span>
  );
}

function Controles({
  reproduciendo,
  anterior,
  alternar,
  siguiente,
  deshabilitado,
  decorativos = false,
}) {
  const elementos = [
    ['Canción anterior', IoPlaySkipBackSharp, anterior],
    [
      reproduciendo ? 'Pausar' : 'Reproducir',
      reproduciendo ? IoPauseSharp : IoPlaySharp,
      alternar,
    ],
    ['Canción siguiente', IoPlaySkipForwardSharp, siguiente],
  ];

  return (
    <div className="ett-buttons">
      {elementos.map(([label, Icono, accion], index) =>
        decorativos ? (
          <span
            key={index}
            className="ett-hardware-button"
            aria-hidden="true"
          >
            {createElement(Icono)}
          </span>
        ) : (
          <button
            key={index}
            type="button"
            className="ett-hardware-button"
            aria-label={label}
            onClick={accion}
            disabled={
              deshabilitado || typeof accion !== 'function'
            }
          >
            {createElement(Icono)}
          </button>
        )
      )}
    </div>
  );
}

function Tocadiscos({
  diseno,
  imagen = '',
  cancion,
  artista,
  reproduciendo = false,
  controles,
  decorativo = false,
}) {
  const acento =
    ACENTOS.find(([id]) => id === diseno.acento)?.[1] ||
    '#1db954';

  return (
    <div
      className={`ett-deck ett-deck--${diseno.base}`}
      style={{ '--ett-accent': acento }}
    >
      <span
        className="ett-foot ett-foot--left"
        aria-hidden="true"
      />

      <span
        className="ett-foot ett-foot--right"
        aria-hidden="true"
      />

      <div className="ett-mat" aria-hidden="true" />

      <div
        className="ett-record"
        style={{ backgroundColor: diseno.colorVinilo }}
      >
        <img
          className="ett-record-texture"
          src={
            texturaVinilo(
              diseno.colorVinilo,
              diseno.acabado
            ) || undefined
          }
          alt=""
          aria-hidden="true"
          draggable="false"
        />

        <div
          className="ett-label"
          aria-hidden="true"
          style={{
            animationPlayState: reproduciendo
              ? 'running'
              : 'paused',
          }}
        >
          <img
            key={imagen || 'sin-portada'}
            src={imagen || PORTADA_VACIA}
            alt=""
            draggable="false"
            onError={portadaAlternativa}
          />
        </div>

        <span className="ett-spindle" aria-hidden="true" />
      </div>

      <div className="ett-pivot" aria-hidden="true">
        <span />
      </div>

      <div
        className={`ett-arm ${
          reproduciendo ? 'ett-arm--playing' : ''
        }`}
        aria-hidden="true"
      >
        <span className="ett-counterweight" />
        <span className="ett-arm-tube" />
        <span className="ett-cartridge" />
      </div>

      <span className="ett-arm-rest" aria-hidden="true" />

      <div
        className="ett-stickers"
        aria-label="Stickers del tocadiscos"
      >
        {STICKERS
          .filter(sticker =>
            diseno.stickers.includes(sticker.id)
          )
          .map(({ id, nombre, Icono }) => (
            <span
              key={id}
              className={`ett-sticker ett-sticker--${id}`}
              role="img"
              aria-label={nombre}
            >
              {createElement(Icono)}
            </span>
          ))}
      </div>

      <div className="ett-nameplate">
        <span aria-hidden="true">⊕</span>

        <strong>
          {diseno.placa.trim() || 'ECHOHEAD'}
        </strong>

        <span aria-hidden="true">⊕</span>
      </div>

      <div className="ett-display">
        <strong>{cancion}</strong>
        <span>{artista}</span>
      </div>

      <div className="ett-hardware">
        <span
          className={`ett-light ${
            reproduciendo ? 'ett-light--on' : ''
          }`}
          aria-hidden="true"
        />

        <Controles
          {...controles}
          reproduciendo={reproduciendo}
          decorativos={decorativo}
        />

        <span
          className="ett-hardware-label"
          aria-hidden="true"
        >
          STEREO / 01
        </span>
      </div>
    </div>
  );
}

function Portada({ imagen }) {
  return (
    <img
      key={imagen || 'sin-portada'}
      className="ett-artwork"
      src={imagen || PORTADA_VACIA}
      alt={imagen ? 'Portada de la canción' : 'Símbolo de EchoHead'}
      draggable="false"
      onError={portadaAlternativa}
    />
  );
}

function PanelVinilo({
  diseno,
  paleta,
  colorActual,
  cambiar,
  elegir,
}) {
  const mensajes = {
    cargando: 'Buscando colores de la portada…',
    vacia:
      'La paleta aparecerá cuando haya una portada disponible.',
    error:
      'Esta portada no permite extraer colores. Puedes usar los clásicos.',
  };

  return (
    <fieldset className="ett-vinyl-editor">
      <legend>Color del vinilo</legend>

      <div
        className="ett-segmented"
        role="group"
        aria-label="Modo de color"
      >
        <button
          type="button"
          aria-pressed={diseno.modoColor === 'manual'}
          onClick={() => cambiar('modoColor', 'manual')}
        >
          Mi elección
        </button>

        <button
          type="button"
          aria-pressed={diseno.modoColor === 'auto'}
          onClick={() => cambiar('modoColor', 'auto')}
        >
          Automático
        </button>
      </div>

      <p className="ett-color-help">
        {diseno.modoColor === 'auto'
          ? 'Sigue el color dominante de cada portada. Si no está disponible, conserva tu color manual.'
          : 'Tu color se mantiene aunque cambie la canción.'}
      </p>

      <p className="ett-palette-title">
        Colores de esta portada
      </p>

      {paleta.estado === 'lista' ? (
        <div
          className="ett-swatches"
          role="group"
          aria-label="Colores de esta portada"
        >
          {paleta.colores.map(color => (
            <button
              key={color}
              type="button"
              className="ett-palette-color"
              style={{ backgroundColor: color }}
              aria-label={`Usar color ${color}`}
              title={color}
              aria-pressed={colorActual === color}
              onClick={() => elegir(color)}
            >
              {colorActual === color && (
                <span className="ett-color-check">
                  <FiCheck />
                </span>
              )}
            </button>
          ))}
        </div>
      ) : (
        <p className="ett-color-help" role="status">
          {mensajes[paleta.estado]}
        </p>
      )}

      <p className="ett-palette-title">Clásicos</p>

      <div className="ett-swatches">
        {VINILOS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`ett-swatch ett-swatch--${value}`}
            aria-label={`Vinilo ${label.toLowerCase()}`}
            title={label}
            aria-pressed={
              colorActual === COLORES_VINILO[value]
            }
            onClick={() =>
              elegir(COLORES_VINILO[value], value)
            }
          >
            <span />
          </button>
        ))}
      </div>

      <p className="ett-color-code">
        Color base: <code>{colorActual.toUpperCase()}</code>
      </p>

      <p className="ett-palette-title">Acabado</p>

      <div
        className="ett-segmented"
        role="group"
        aria-label="Acabado del vinilo"
      >
        {['brillante', 'mate'].map(value => (
          <button
            key={value}
            type="button"
            aria-pressed={diseno.acabado === value}
            onClick={() => cambiar('acabado', value)}
          >
            {value === 'brillante' ? 'Brillante' : 'Mate'}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function Compartir({ captura, cerrar }) {
  const modal = useRef(null);
  const lienzo = useRef(null);
  const bloqueo = useRef(false);
  const id = useId();

  const [imagen, setImagen] = useState('');
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState('');
  const [intento, setIntento] = useState(0);
  const [compartiendo, setCompartiendo] = useState(false);

  useEffect(() => {
    const elemento = modal.current;
    const foco = document.activeElement;

    elemento.showModal();

    return () => {
      elemento.close();

      if (foco?.isConnected) {
        foco.focus({ preventScroll: true });
      }
    };
  }, []);

    useEffect(() => {
    let activo = true;
    let urlImagen = '';
    let etapa = 'cargar las imágenes';

    setError('');
    setImagen('');
    setArchivo(null);

    // Si una operación se queda pendiente, mostramos en qué paso ocurrió.
    const limite = window.setTimeout(() => {
      activo = false;
      setError(`El navegador tardó demasiado en ${etapa}. Pulsa Reintentar.`);
    }, 25000);

    async function generar() {
      let esperaRecursos;

      try {
        const elemento = lienzo.current;
        if (!elemento) throw new Error();

        const imagenes = [...elemento.querySelectorAll('img')];
        for (const img of imagenes) {
          img.loading = 'eager';
        }

        // Una fuente o portada lenta no debe bloquear todo el tocadiscos.
        await Promise.race([
          Promise.allSettled([
            document.fonts?.ready,
            ...imagenes.map(img => img.decode()),
          ]),
          new Promise(resolve => {
            esperaRecursos = window.setTimeout(resolve, 4000);
          }),
        ]);

        if (!activo) return;
        etapa = 'dibujar el tocadiscos';

        const canvas = await html2canvas(elemento, {
          scale: window.matchMedia('(max-width: 768px)').matches ? 1 : 2,
          useCORS: true,
          imageTimeout: 6000,
          backgroundColor: '#e9e9e9',
          windowWidth: 1200,
          onclone: (_doc, copia) => {
            copia.style.position = 'static';
            copia.style.left = '0';
          },
        });

        if (!activo) return;
        etapa = 'crear el archivo PNG';

        const blob = await new Promise(resolve => {
          canvas.toBlob(resolve, 'image/png');
        });

        if (!activo) return;
        if (!blob) throw new Error();

        // La vista previa y la descarga utilizan el mismo PNG.
        urlImagen = URL.createObjectURL(blob);
        setImagen(urlImagen);
        setArchivo(
          new File([blob], 'EchoHead-mi-tocadiscos.png', {
            type: 'image/png',
          })
        );
      } catch {
        if (activo) {
          setError(`No pudimos ${etapa}. Pulsa Reintentar.`);
        }
      } finally {
        window.clearTimeout(esperaRecursos);
        window.clearTimeout(limite);
      }
    }

    generar();

    return () => {
      activo = false;
      window.clearTimeout(limite);
      if (urlImagen) URL.revokeObjectURL(urlImagen);
    };
  }, [captura, id, intento]);

  async function compartir() {
    if (!archivo || bloqueo.current) return;

    bloqueo.current = true;
    setCompartiendo(true);
    setError('');

    try {
      await navigator.share({
        title: 'Mi tocadiscos en EchoHead',
        files: [archivo],
      });
    } catch (err) {
      if (err.name !== 'AbortError') {
        setError(
          'No se pudo compartir. Puedes descargar la imagen.'
        );
      }
    } finally {
      bloqueo.current = false;
      setCompartiendo(false);
    }
  }

  return (
    <>
      <dialog
        ref={modal}
        className="ett-share"
        aria-labelledby={`${id}-titulo`}
        onCancel={event => {
          event.preventDefault();
          event.stopPropagation();

          if (!bloqueo.current) cerrar();
        }}
      >
        <div className="ett-share-head">
          <h2 id={`${id}-titulo`}>
            Tu tocadiscos, para compartir
          </h2>

          <button
            type="button"
            className="ett-icon-button"
            aria-label="Cerrar vista previa"
            disabled={compartiendo}
            onClick={cerrar}
          >
            <FiX />
          </button>
        </div>

        {imagen ? (
          <img
            src={imagen}
            className="ett-share-preview"
            alt="Vista previa de tu tocadiscos personalizado y la canción"
          />
        ) : (
          !error && (
            <p className="ett-message" role="status">
              Preparando tu imagen…
            </p>
          )
        )}

        {error && (
          <p className="ett-message" role="alert">
            {error}
          </p>
        )}

        <div className="ett-share-actions">
          {imagen && (
            <a
              className="ett-primary"
              href={imagen}
              download="EchoHead-mi-tocadiscos.png"
            >
              <FiDownload />
              Descargar PNG
            </a>
          )}

          {archivo &&
            typeof navigator.share === 'function' &&
            navigator.canShare?.({ files: [archivo] }) && (
              <button
                type="button"
                className="ett-button"
                onClick={compartir}
                disabled={compartiendo}
              >
                <FiShare2 />
                Compartir imagen
              </button>
            )}

          {error && !imagen && (
            <button
              type="button"
              className="ett-button"
              onClick={() => {
                setError('');
                setIntento(value => value + 1);
              }}
            >
              Reintentar
            </button>
          )}
        </div>
      </dialog>

      <div
        ref={lienzo}
        id={`${id}-lienzo`}
        className="ett-export"
        aria-hidden="true"
      >
        <div className="ett-export-head">
          <Marca />
          <span>MI TOCADISCOS</span>
        </div>

        <h2>
          {captura.diseno.placa.trim() || 'Mi tocadiscos'}
        </h2>

        <p className="ett-export-user">
          Una selección de {captura.username}
        </p>

        <Tocadiscos
          {...captura}
          decorativo
          reproduciendo={false}
        />

        <div className="ett-export-song">
          <Portada imagen={captura.imagen} />
          <span>EN MI TOCADISCOS</span>
          <h3>{captura.cancion}</h3>
          <p>{captura.artista}</p>
        </div>
      </div>
    </>
  );
}

function Estudio({
  cerrarModal,
  username = 'USER',
  cancion = 'Sin reproducir',
  artista = 'Desconocido',
  imagenAlbum = '',
  estaReproduciendo = false,
  pausarReproducir,
  siguienteCancion,
  cancionAnterior,
  idUsuario,
  modoDecorativo = false,
}) {
  const esDecorativo =
    modoDecorativo ||
    typeof pausarReproducir !== 'function';

  const reproduciendoVisible =
    !esDecorativo && estaReproduciendo;

  const clave =
    `echohead:tocadiscos:v1:${
      encodeURIComponent(String(idUsuario || username))
    }`;

  const [diseno, setDiseno] = useState(() =>
    leerDiseno(clave, username)
  );

  const {
    canciones: favoritas,
    cargando: cargandoFavoritas,
    error: errorFavoritas,
    reintentar: reintentarFavoritas,
  } = useCancionesFavoritas(esDecorativo);

  const favoritaElegida = favoritas.find(
    favorita => favorita.id === diseno.cancionFavoritaId
  );

  const cancionVisible = esDecorativo
    ? favoritaElegida?.nombre || 'Mi disco'
    : cancion;

  const artistaVisible = esDecorativo
    ? favoritaElegida
      ? 'De tus canciones favoritas'
      : 'Diseño personal'
    : artista;

  const imagenVisible = esDecorativo
    ? favoritaElegida?.imagen || ''
    : imagenAlbum;

  const seleccionNoDisponible =
    esDecorativo &&
    !cargandoFavoritas &&
    !errorFavoritas &&
    Boolean(diseno.cancionFavoritaId) &&
    !favoritaElegida;

  const paleta = usePaletaPortada(imagenVisible);

  const colorActual =
    diseno.modoColor === 'auto' && paleta.colores.length
      ? paleta.colores[0]
      : diseno.colorVinilo;

  const disenoVisible = {
    ...diseno,
    colorVinilo: colorActual,
  };

  const [guardado, setGuardado] = useState(() =>
    JSON.stringify(diseno)
  );

  const [panel, setPanel] = useState(true);
  const [aviso, setAviso] = useState('');
  const [error, setError] = useState('');
  const [captura, setCaptura] = useState(null);

  const modal = useRef(null);
  const id = useId();

  const esModal = typeof cerrarModal === 'function';
  const Contenedor = esModal ? 'dialog' : 'main';
  const hayCambios = JSON.stringify(diseno) !== guardado;

  const controles = {
    anterior: esDecorativo ? undefined : cancionAnterior,
    alternar: esDecorativo ? undefined : pausarReproducir,
    siguiente: esDecorativo ? undefined : siguienteCancion,
    deshabilitado:
      esDecorativo ||
      (!imagenAlbum && cancion === 'Sin reproducir'),
  };

  useEffect(() => {
    if (!esModal) return;

    const elemento = modal.current;
    const foco = document.activeElement;
    const overflow = document.body.style.overflow;

    elemento.showModal();
    document.body.style.overflow = 'hidden';

    return () => {
      elemento.close();
      document.body.style.overflow = overflow;

      if (foco?.isConnected) {
        foco.focus({ preventScroll: true });
      }
    };
  }, [esModal]);

  function cambiar(campo, value) {
    setDiseno(prev => ({ ...prev, [campo]: value }));
    setAviso('');
    setError('');
  }

  function elegirColor(color, vinilo = 'negro') {
    if (!colorValido(color)) return;

    setDiseno(prev => ({
      ...prev,
      colorVinilo: color,
      vinilo,
      modoColor: 'manual',
    }));

    setAviso('');
    setError('');
  }

  function sticker(idSticker) {
    setDiseno(prev => ({
      ...prev,
      stickers: prev.stickers.includes(idSticker)
        ? prev.stickers.filter(value => value !== idSticker)
        : [...prev.stickers, idSticker],
    }));

    setAviso('');
    setError('');
  }

  function guardar(event) {
    event.preventDefault();

    try {
      localStorage.setItem(
        clave,
        JSON.stringify({ version: 1, ...diseno })
      );

      setGuardado(JSON.stringify(diseno));
      setAviso('Diseño guardado en este navegador.');
      setError('');
    } catch {
      setError(
        'El navegador no permitió guardar. Puedes seguir personalizando y compartir tu diseño.'
      );
    }
  }

  return (
    <Contenedor
      ref={modal}
      className={`ett-studio ${
        !esModal ? 'ett-studio--page' : ''
      }`}
      aria-labelledby={`${id}-titulo`}
      onCancel={
        esModal
          ? event => {
              event.preventDefault();

              if (event.target === event.currentTarget) {
                cerrarModal();
              }
            }
          : undefined
      }
    >
      <header className="ett-topbar">
        <Marca />

        <span className="ett-topbar-label">
          Mi tocadiscos
        </span>

        <div className="ett-topbar-actions">
          <button
            type="button"
            className="ett-button"
            aria-label="Personalizar tocadiscos"
            aria-expanded={panel}
            aria-controls={`${id}-panel`}
            onClick={() => setPanel(value => !value)}
          >
            <FiSettings />
            <span>Personalizar</span>
          </button>

          <button
            type="button"
            className="ett-button"
            aria-label="Compartir tocadiscos"
            onClick={() =>
              setCaptura({
                diseno: {
                  ...disenoVisible,
                  stickers: [...diseno.stickers],
                },
                imagen: imagenVisible,
                cancion: cancionVisible,
                artista: artistaVisible,
                username,
              })
            }
          >
            <FiShare2 />
            <span>Compartir</span>
          </button>

          {esModal ? (
            <button
              type="button"
              className="ett-icon-button"
              aria-label="Cerrar tocadiscos"
              onClick={cerrarModal}
            >
              <FiX />
            </button>
          ) : (
            <a
              className="ett-icon-button"
              href="/"
              aria-label="Volver al inicio"
            >
              <FiX />
            </a>
          )}
        </div>
      </header>

      <div
        className={`ett-layout ${
          !panel ? 'ett-layout--solo' : ''
        }`}
      >
        <section
          className="ett-preview"
          aria-label="Tu tocadiscos"
        >
          <p className="ett-eyebrow">
            DISEÑA TU FORMA DE ESCUCHAR
          </p>

          <h1 id={`${id}-titulo`}>
            Hecho a tu manera.
          </h1>

          <Tocadiscos
            diseno={disenoVisible}
            imagen={imagenVisible}
            cancion={cancionVisible}
            artista={artistaVisible}
            reproduciendo={reproduciendoVisible}
            controles={controles}
            decorativo={esDecorativo}
          />

          <div className="ett-now">
            <Portada imagen={imagenVisible} />

            <div className="ett-song-meta">
              <h2>{cancionVisible}</h2>
              <p>{artistaVisible}</p>
            </div>

            <span className="ett-status">
              <i
                aria-hidden="true"
                className={
                  reproduciendoVisible
                    ? 'ett-status--on'
                    : ''
                }
              />

              {esDecorativo
                ? 'Disco decorativo'
                : reproduciendoVisible
                  ? 'Sonando ahora'
                  : cancion === 'Sin reproducir'
                    ? 'Sin reproducción activa'
                    : 'En pausa'}
            </span>
          </div>

          {!esDecorativo && (
            <div className="ett-mobile-controls">
              <Controles
                {...controles}
                reproduciendo={reproduciendoVisible}
              />
            </div>
          )}
        </section>

        {panel && (
          <form
            id={`${id}-panel`}
            className="ett-editor"
            onSubmit={guardar}
          >
            <h2>
              Personaliza{' '}
              <br />
              tu tocadiscos
            </h2>

            {esDecorativo && (
              <fieldset>
                <legend>La canción de tu disco</legend>

                <label
                  className="ett-input-label"
                  htmlFor={`${id}-cancion-favorita`}
                >
                  Canciones favoritas de tu perfil
                </label>

                <select
                  id={`${id}-cancion-favorita`}
                  className="ett-input"
                  style={{
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                  }}
                  value={favoritaElegida?.id || ''}
                  disabled={
                    cargandoFavoritas ||
                    Boolean(errorFavoritas) ||
                    favoritas.length === 0
                  }
                  onChange={event => {
                    cambiar(
                      'cancionFavoritaId',
                      event.target.value
                    );
                  }}
                >
                  <option value="">
                    {cargandoFavoritas
                      ? 'Cargando canciones…'
                      : 'Usar el símbolo de EchoHead'}
                  </option>

                  {favoritas.map(favorita => (
                    <option
                      key={favorita.id}
                      value={favorita.id}
                    >
                      {favorita.nombre}
                    </option>
                  ))}
                </select>

                <p className="ett-color-help" role="status">
                  {cargandoFavoritas
                    ? 'Consultando tus favoritas…'
                    : errorFavoritas
                      ? ''
                      : favoritas.length === 0
                        ? 'Añade canciones en Perfil → Editar perfil → Mis gustos.'
                        : seleccionNoDisponible
                          ? 'La canción guardada ya no está entre tus favoritas. Elige otra.'
                          : 'Usamos su portada para decorar el disco. No reproduce audio.'}
                </p>

                {errorFavoritas && (
                  <div>
                    <p className="ett-message" role="alert">
                      {errorFavoritas}
                    </p>

                    <button
                      type="button"
                      className="ett-button"
                      onClick={reintentarFavoritas}
                    >
                      Volver a intentar
                    </button>
                  </div>
                )}

                {seleccionNoDisponible && (
                  <button
                    type="button"
                    className="ett-button"
                    onClick={() => {
                      cambiar('cancionFavoritaId', '');
                    }}
                  >
                    Usar el símbolo de EchoHead
                  </button>
                )}
              </fieldset>
            )}

            <fieldset>
              <legend>Base</legend>

              <div className="ett-materials">
                {BASES.map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={diseno.base === value}
                    onClick={() => cambiar('base', value)}
                  >
                    <span
                      className={`ett-material ett-material--${value}`}
                    />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
            </fieldset>

            <PanelVinilo
              diseno={diseno}
              paleta={paleta}
              colorActual={colorActual}
              cambiar={cambiar}
              elegir={elegirColor}
            />

            <fieldset>
              <legend>Detalles</legend>

              <div className="ett-swatches">
                {ACENTOS.map(([value, color]) => (
                  <button
                    key={value}
                    type="button"
                    className="ett-accent"
                    style={{ backgroundColor: color }}
                    aria-label={`Detalles ${value}`}
                    title={value}
                    aria-pressed={diseno.acento === value}
                    onClick={() => cambiar('acento', value)}
                  >
                    {diseno.acento === value && (
                      <FiCheck
                        style={{
                          color:
                            value === 'grafito'
                              ? '#e9e9e9'
                              : '#2d2d2d',
                        }}
                      />
                    )}
                  </button>
                ))}
              </div>
            </fieldset>

            <label
              className="ett-input-label"
              htmlFor={`${id}-placa`}
            >
              Tu placa
            </label>

            <input
              id={`${id}-placa`}
              className="ett-input"
              value={diseno.placa}
              maxLength={24}
              onChange={event =>
                cambiar('placa', event.target.value)
              }
              placeholder="Dale un nombre a tu tocadiscos"
            />

            <fieldset className="ett-sticker-field">
              <legend>Stickers</legend>

              <div className="ett-sticker-options">
                {STICKERS.map(
                  ({ id: value, nombre, Icono }) => (
                    <button
                      key={value}
                      type="button"
                      aria-label={nombre}
                      aria-pressed={
                        diseno.stickers.includes(value)
                      }
                      onClick={() => sticker(value)}
                    >
                      {createElement(Icono)}
                    </button>
                  )
                )}
              </div>
            </fieldset>

            <button
              type="submit"
              className="ett-primary ett-save"
            >
              <FiCheck />
              Guardar diseño
            </button>

            <p className="ett-save-status" role="status">
              {aviso ||
                (hayCambios
                  ? 'Cambios sin guardar.'
                  : 'Se guarda en este navegador.')}
            </p>

            {error && (
              <p className="ett-message" role="alert">
                {error}
              </p>
            )}
          </form>
        )}
      </div>

      {captura && (
        <Compartir
          captura={captura}
          cerrar={() => setCaptura(null)}
        />
      )}
    </Contenedor>
  );
}

export default function ReproductorEstetico(props) {
  return (
    <Estudio
      key={String(props.idUsuario || props.username || 'USER')}
      {...props}
    />
  );
}