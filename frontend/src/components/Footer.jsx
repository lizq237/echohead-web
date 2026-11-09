import { Link } from 'react-router-dom';
import './Footer.css';

function Footer() {
    return (
        <footer className="footer-echohead">
            <div className="footer-enlaces">
                <Link to="/about">About Us</Link>
                <Link to="/privacidad">Privacidad</Link>
                <Link to="/terminos">Términos</Link>
                <Link to="/contacto">Contacto</Link>
                {/* Enlace externo a tu GitHub */}
            </div>
            
            <div className="footer-creditos">
                <p>© 2026 Lizeth Quiroz | EchoHead Project.</p>
                {/* El crédito obligatorio para que Spotify apruebe la app */}
                <p className="texto-spotify">
                    Music data and audio powered by <a href="https://developer.spotify.com/" target="_blank" rel="noreferrer">Spotify</a>.
                </p>
            </div>
        </footer>
    );
}

export default Footer;