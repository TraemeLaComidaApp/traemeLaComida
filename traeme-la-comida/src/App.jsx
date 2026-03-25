import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import VistaCliente from './pages/VistaCliente';
import VistaCocina from './pages/VistaCocina';
import VistaBarra from './pages/VistaBarra';
import VistaCamarero from './pages/VistaCamarero';
import VistaPropietario from './pages/VistaPropietario';
import { getConfiguracionLocal } from './services/apiAuth';

function App() {
  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getConfiguracionLocal();
        if (config && config.logo_url) {
          let link = document.querySelector("link[rel~='icon']");
          if (!link) {
            link = document.createElement('link');
            link.rel = 'icon';
            document.head.appendChild(link);
          }
          link.href = config.logo_url;
        }
      } catch (error) {
        console.error("Error fetching config for favicon:", error);
      }
    };
    fetchConfig();
  }, []);

  return (
    <Router>
      <Routes>
        {/* LA RUTA DEL CLIENTE: Acceso por UUID de mesa (se genera al crear la mesa y se rota al cerrar cuenta) */}
        <Route
          path="/mesa/:uuid"
          element={
            <VistaCliente />
          }
        />

        {/* RUTAS DEL STAFF: No necesitan GPS (ellos están trabajando allí) */}
        <Route path="/staff/cocina" element={<VistaCocina />} />
        <Route path="/barra" element={<VistaBarra />} />
        <Route path="/barra/:uuid" element={<VistaBarra />} />
        <Route path="/admin/gestion" element={<VistaPropietario />} />
        <Route path="/staff/mapa" element={<VistaCamarero />} />

        {/* HOME */}
        <Route path="/" element={
          <div style={{ padding: '50px', textAlign: 'center' }}>
            <h1>Bienvenido al Sistema de Desayunos</h1>
            <p>Escanea el QR de tu mesa para empezar.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '20px' }} >
              <a href="/staff/cocina">Ir a la Cocina</a>
              <a href="/barra">Ir a la Barra</a>
              <a href="/admin/gestion">Ir a la Gestión</a>
              <a href="/staff/mapa">Ir al Mapa</a>
            </div>
          </div>
        } />
      </Routes>
    </Router>
  );
}

export default App;
