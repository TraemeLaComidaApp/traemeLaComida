import React, { useState, useEffect } from 'react';
import './DatosNegocio.css';
import { getConfiguracionLocal, getCredenciales, updateConfiguracionLocal, updateCredencial } from '../services/apiAuth';

const DatosNegocio = ({ nombreActual, alGuardarNombre }) => {
    // --- ESTADOS: DATOS GENERALES ---
    const [nombreLocal, setNombreLocal] = useState(nombreActual);
    const [logo, setLogo] = useState(null); // Para mostrar la vista previa en pantalla
    const [logoArchivoFisico, setLogoArchivoFisico] = useState(null); // NUEVO: Para enviar al servidor

    // --- ESTADOS: CREDENCIALES PROPIETARIO ---
    const [usuarioPropietario, setUsuarioPropietario] = useState('propietario');
    const [emailPropietario, setEmailPropietario] = useState('propietario@mibar.com');
    const [passPropietario, setPassPropietario] = useState('1234');

    // --- ESTADOS: CREDENCIALES PERSONAL ---
    const [usuarioCamarero, setUsuarioCamarero] = useState('sala');
    const [pinCamarero, setPinCamarero] = useState('1234');

    const [usuarioCocina, setUsuarioCocina] = useState('cocina');
    const [pinCocina, setPinCocina] = useState('1234');

    const [guardadoExito, setGuardadoExito] = useState(false);
    const [configId, setConfigId] = useState(null);

    useEffect(() => {
        const cargarDatos = async () => {
            try {
                const config = await getConfiguracionLocal();
                if (config) {
                    setConfigId(config.id);
                    setNombreLocal(config.nombre_local || nombreActual);
                    setLogo(config.logo_url || null);
                    if (config.nombre_local) alGuardarNombre(config.nombre_local);
                }

                const creds = await getCredenciales();
                creds.forEach(cred => {
                    if (cred.rol === 'propietario') {
                        setUsuarioPropietario(cred.usuario);
                        setPassPropietario(cred.password);
                        setEmailPropietario(cred.email || '');
                    } else if (cred.rol === 'camarero') {
                        setUsuarioCamarero(cred.usuario);
                        setPinCamarero(cred.password);
                    } else if (cred.rol === 'cocina') {
                        setUsuarioCocina(cred.usuario);
                        setPinCocina(cred.password);
                    }
                });
            } catch (error) {
                console.error("Error al cargar datos:", error);
            }
        };
        cargarDatos();
    }, [nombreActual, alGuardarNombre]);

    // --- FUNCIONES ---
    const manejarLogo = (e) => {
        const file = e.target.files[0];
        if (file) {
            setLogoArchivoFisico(file); // Guardamos el archivo binario
            setLogo(URL.createObjectURL(file)); // Mostramos la previsualización temporal
        }
    };

    const manejarGuardar = async () => {
        try {
            // Enviamos el archivo real si han subido uno nuevo, si no, enviamos la URL antigua
            const dataAAgregar = logoArchivoFisico ? logoArchivoFisico : logo;

            await updateConfiguracionLocal(configId, nombreLocal, dataAAgregar);
            await updateCredencial('propietario', usuarioPropietario, passPropietario, emailPropietario);
            await updateCredencial('camarero', usuarioCamarero, pinCamarero, null);
            await updateCredencial('cocina', usuarioCocina, pinCocina, null);

            alGuardarNombre(nombreLocal);

            // Limpiamos el archivo físico pendiente
            setLogoArchivoFisico(null);

            setGuardadoExito(true);
            setTimeout(() => setGuardadoExito(false), 3000);
        } catch (error) {
            console.error("Error al guardar datos:", error);
            alert("Error al guardar. Verifica la consola.");
        }
    };

    return (
        <div className="negocio-container">

            {/* BLOQUE 1: INFORMACIÓN GENERAL */}
            <div className="negocio-card">
                <h3>Información General</h3>
                <p className="subtitle">Configura la identidad que verán tus clientes.</p>

                <div className="form-group">
                    <label>Nombre del Establecimiento</label>
                    <input
                        type="text"
                        value={nombreLocal}
                        onChange={(e) => setNombreLocal(e.target.value)}
                        placeholder="Ej: Cafetería Central"
                    />
                </div>

                <div className="form-group">
                    <label>Logo del Negocio</label>
                    <div className="logo-upload-wrapper">
                        <div className="logo-preview">
                            {logo ? (
                                <img src={logo} alt="Logo preview" />
                            ) : (
                                <span className="material-symbols-outlined">image</span>
                            )}
                        </div>
                        <div className="upload-controls">
                            <input
                                type="file"
                                id="logo-input"
                                accept="image/*"
                                onChange={manejarLogo}
                                hidden
                            />
                            <label htmlFor="logo-input" className="btn-upload">
                                Seleccionar Imagen
                            </label>
                            <p>Recomendado: PNG o JPG cuadrado (min. 512x512px)</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* BLOQUE 2: SEGURIDAD Y ACCESOS */}
            <div className="negocio-card seguridad-card">
                <h3>Seguridad y Accesos</h3>
                <p className="subtitle">Gestiona los usuarios y contraseñas de tu equipo.</p>

                {/* ACCESO PROPIETARIO */}
                <div className="acceso-seccion">
                    <h4>🔑 Acceso Propietario (Administrador)</h4>
                    <p className="seccion-desc">Credenciales con acceso total al panel de control y facturación.</p>

                    <div className="form-row form-row-3">
                        <div className="form-group">
                            <label>Usuario</label>
                            <input
                                type="text"
                                value={usuarioPropietario}
                                onChange={(e) => setUsuarioPropietario(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Contraseña</label>
                            <input
                                type="text"
                                value={passPropietario}
                                onChange={(e) => setPassPropietario(e.target.value)}
                            />
                        </div>
                        <div className="form-group">
                            <label>Correo de Recuperación</label>
                            <input
                                type="email"
                                value={emailPropietario}
                                onChange={(e) => setEmailPropietario(e.target.value)}
                            />
                        </div>
                    </div>
                </div>

                <div className="divider"></div>

                {/* ACCESOS DE PERSONAL */}
                <div className="acceso-seccion">
                    <h4>📱 Accesos de Personal (Terminales)</h4>
                    <p className="seccion-desc">Credenciales limitadas para las pantallas de trabajo (Sala y Cocina).</p>

                    {/* Camareros */}
                    <div className="staff-card">
                        <div className="staff-header">
                            <span className="material-symbols-outlined">restaurant</span>
                            <h5>Terminal de Sala (Camareros)</h5>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Usuario Sala</label>
                                <input
                                    type="text"
                                    value={usuarioCamarero}
                                    onChange={(e) => setUsuarioCamarero(e.target.value)}
                                />
                            </div>
                            <div className="form-group pin-group">
                                <label>PIN Acceso</label>
                                <input
                                    type="text"
                                    maxLength="4"
                                    value={pinCamarero}
                                    onChange={(e) => setPinCamarero(e.target.value.replace(/\D/g, ''))}
                                    placeholder="0000"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Cocina */}
                    <div className="staff-card mt-15">
                        <div className="staff-header">
                            <span className="material-symbols-outlined">precision_manufacturing</span>
                            <h5>Terminal KDS (Cocina)</h5>
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label>Usuario Cocina</label>
                                <input
                                    type="text"
                                    value={usuarioCocina}
                                    onChange={(e) => setUsuarioCocina(e.target.value)}
                                />
                            </div>
                            <div className="form-group pin-group">
                                <label>PIN Acceso</label>
                                <input
                                    type="text"
                                    maxLength="4"
                                    value={pinCocina}
                                    onChange={(e) => setPinCocina(e.target.value.replace(/\D/g, ''))}
                                    placeholder="0000"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* BOTONERA DE GUARDADO */}
            <div className="datos-footer">
                {guardadoExito && (
                    <div className="mensaje-exito">
                        <span className="material-symbols-outlined">check_circle</span>
                        Cambios guardados correctamente
                    </div>
                )}
                <button className="btn-save-negocio" onClick={manejarGuardar}>
                    Guardar Cambios
                </button>
            </div>
        </div>
    );
};

export default DatosNegocio;