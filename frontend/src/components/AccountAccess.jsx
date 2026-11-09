import { useEffect, useRef, useState } from 'react';
import { accountRequest } from '../lib/accounts';
import './AccountAccess.css';


function RecoveryKey({ code, onContinue }) {
  const [saved, setSaved] = useState(false);
  const heading = useRef(null);
  useEffect(() => { heading.current?.focus(); }, []);
  return <div className="eh-account-key">
    <h3 ref={heading} tabIndex={-1}>Guarda tu clave de recuperación</h3>
    <p>Es la forma de recuperar tu cuenta si olvidas la contraseña. Guárdala en tu gestor de contraseñas. No la compartas. La clave anterior, si existía, ya no sirve.</p>
    <textarea aria-label="Clave de recuperación" readOnly value={code} onFocus={event => event.target.select()} />
    <label className="eh-account-check"><input type="checkbox" checked={saved} onChange={event => setSaved(event.target.checked)} /> Ya guardé mi clave en un lugar seguro.</label>
    <button type="button" className="eh-account-primary" disabled={!saved} onClick={onContinue}>Continuar</button>
  </div>;
}

export default function AccountAccess({ onSession, existing = false, accountName = null }) {
  const [mode, setMode] = useState(existing ? (accountName ? 'change' : 'attach') : 'login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState(null);
  const lock = useRef(false);
  const create = ['register', 'attach'].includes(mode);
  async function submit(event) {
    event.preventDefault();
    if (lock.current) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    const body = { password: fields.get('password') };
    if (mode !== 'change') body.username = fields.get('username');
    if (create) body.nombre = fields.get('nombre');
    if (mode === 'recover') body.recovery_code = fields.get('recovery_code')?.trim();
    if (mode === 'change') body.current_password = fields.get('current_password');
    lock.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const path = { login: 'login', register: 'register', recover: 'recover', attach: 'credentials', change: 'password' }[mode];
      const data = await accountRequest(`/auth/${path}`, body);
      form.reset();
      if (data.recovery_code) setResult(data);
      else onSession(data);
    } catch (err) { setError(err.message); }
    finally { lock.current = false; setBusy(false); }
  }
  if (result) return <RecoveryKey code={result.recovery_code} onContinue={() => {
    if (result.user) onSession(result);
    else { setMode('login'); setNotice('Contraseña actualizada. Ya puedes iniciar sesión.'); }
    setResult(null);
  }} />;
  return <div className="eh-account-access">
    {!existing && <div className="eh-account-tabs" aria-label="Acceso a EchoHead">
      <button type="button" aria-pressed={mode === 'login'} disabled={busy} onClick={() => { setMode('login'); setError(''); }}>Entrar</button>
      <button type="button" aria-pressed={mode === 'register'} disabled={busy} onClick={() => { setMode('register'); setError(''); }}>Crear cuenta</button>
    </div>}
    <form onSubmit={submit}>
      <h3>{({login:'Entra a tu diario',register:'Crea tu diario musical',recover:'Recupera tu cuenta',attach:'Añade acceso sin Spotify',change:'Cambia tu contraseña'})[mode]}</h3>
      {create && <label>Nombre visible<input name="nombre" required maxLength={100} autoComplete="nickname" /></label>}
      {mode !== 'change' && <label>Usuario<input name="username" required minLength={3} maxLength={32} pattern="[a-zA-Z0-9_]{3,32}" autoComplete="username" autoCapitalize="none" spellCheck={false} aria-describedby="eh-username-help" /></label>}
      {mode !== 'change' && <small id="eh-username-help">De 3 a 32 letras sin acentos, números o guion bajo.</small>}
      {mode === 'recover' && <label>Clave de recuperación<input name="recovery_code" required autoComplete="off" spellCheck={false} /></label>}
      {mode === 'change' && <label>Contraseña actual<input name="current_password" type="password" required autoComplete="current-password" maxLength={128} /></label>}
      <label>{mode === 'login' ? 'Contraseña' : 'Nueva contraseña'}<input name="password" type="password" required minLength={mode === 'login' ? 1 : 15} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} aria-describedby={mode !== 'login' ? 'eh-password-help' : undefined} /></label>
      {mode !== 'login' && <small id="eh-password-help">Al menos 15 caracteres. Puedes usar una frase larga.</small>}
      {error && <p role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      <button className="eh-account-primary" type="submit" disabled={busy}>{busy ? 'Un momento…' : ({login:'Entrar a EchoHead',register:'Crear mi cuenta',recover:'Restablecer contraseña',attach:'Guardar mi acceso',change:'Guardar contraseña'})[mode]}</button>
      {mode === 'login' && <button type="button" className="eh-account-link" disabled={busy} onClick={() => { setMode('recover'); setError(''); }}>Olvidé mi contraseña</button>}
    </form>
  </div>;
}
