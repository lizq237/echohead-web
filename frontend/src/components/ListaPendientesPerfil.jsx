import ColeccionPerfil from './ColeccionPerfil';

export default function ListaPendientesPerfil(props) {
  return (
    <ColeccionPerfil
      {...props}
      modo="pendientes"
    />
  );
}