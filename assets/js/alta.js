/**
 * NetControl - Lógica del Formulario de Alta de Dispositivos
 */
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  verifySession();
  loadUserInfo();
  setupDynamicFields();
  setupFormSubmit();
});

/**
 * Verifica sesión activa
 */
function verifySession() {
  const isAuth = localStorage.getItem('netcontrol_auth');
  if (!isAuth || isAuth !== 'true') {
    window.location.href = '../index.html';
  }
}

/**
 * Carga el correo del usuario en el header
 */
function loadUserInfo() {
  const userEmail = localStorage.getItem('netcontrol_user');
  if (userEmail) {
    document.querySelectorAll('.user-email-text').forEach(el => {
      el.textContent = userEmail;
    });
  }
}

/**
 * Controla la visibilidad condicional de campos (SSID para WiFi e IP para estáticas)
 */
function setupDynamicFields() {
  const tipoConexionSelect = document.getElementById('tipo_conexion');
  const contenedorSsid = document.getElementById('contenedor-ssid');
  
  tipoConexionSelect.addEventListener('change', (e) => {
    if (e.target.value === 'WIFI') {
      contenedorSsid.classList.remove('hidden');
    } else {
      contenedorSsid.classList.add('hidden');
      document.getElementById('ssid').value = '';
    }
  });

  const tipoIpSelect = document.getElementById('tipo_ip');
  const contenedorIp = document.getElementById('contenedor-ip');

  tipoIpSelect.addEventListener('change', (e) => {
    const val = e.target.value;
    if (val === 'estatica' || val === 'DHCP estatica') {
      contenedorIp.classList.remove('hidden');
    } else {
      contenedorIp.classList.add('hidden');
      document.getElementById('ip').value = '';
    }
  });
}

/**
 * Gestiona el envío del formulario hacia la Edge Function
 */
function setupFormSubmit() {
  const form = document.getElementById('form-alta');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const btnGuardar = document.getElementById('btn-guardar');
    btnGuardar.disabled = true;
    btnGuardar.innerHTML = `<i class="fa-solid fa-spinner fa-spin mr-2"></i> Guardando...`;

    // Recoger valores del formulario
    const payload = {
      planta: document.getElementById('planta').value,
      estancia: document.getElementById('estancia').value,
      tipo_conexion: document.getElementById('tipo_conexion').value,
      ssid: document.getElementById('ssid').value || null,
      id_hw: document.getElementById('id_hw').value.trim(),
      mac: document.getElementById('mac').value.trim(),
      tipo_ip: document.getElementById('tipo_ip').value,
      ip: document.getElementById('ip').value.trim() || null,
      puerto_rout_ext: document.getElementById('puerto_rout_ext').value || null,
      puerto_rout_int: document.getElementById('puerto_rout_int').value || null,
      puerto_dock_int: document.getElementById('puerto_dock_int').value || null,
      puerto_dock_ext: document.getElementById('puerto_dock_ext').value || null,
      dock_network: document.getElementById('dock_network').value.trim() || null,
      servicio: document.getElementById('servicio').value,
      tipo_servicio: document.getElementById('tipo_servicio').value
    };

    try {
      const { data, error } = await supabase.functions.invoke('guardar-dispositivo', {
        body: payload
      });

      if (error || !data || !data.success) {
        throw new Error(data?.message || error?.message || 'Error desconocido al guardar.');
      }

      alert('¡Dispositivo registrado correctamente!');
      window.location.href = 'gest_direcciones.html';

    } catch (err) {
      console.error('Error al dar de alta:', err);
      alert(`No se pudo guardar el dispositivo: ${err.message}`);
      btnGuardar.disabled = false;
      btnGuardar.innerHTML = `<i class="fa-solid fa-floppy-disk mr-2"></i> Guardar Dispositivo`;
    }
  });
}
