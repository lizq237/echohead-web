import ColeccionPerfil from './ColeccionPerfil';

export default function ListaFavoritosPerfil(props) {
  return (
    <ColeccionPerfil
      {...props}
      modo="favoritos"
    />
  );
}