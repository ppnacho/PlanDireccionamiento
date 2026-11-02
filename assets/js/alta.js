/**
 * NetControl - Lógica de Alta Normalizada (Dispositivo + Múltiples Servicios)
 */
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  verifySession();
  loadUserInfo();
  
  // Añadir un servicio por defecto al cargar la página
  addServiceCard();

  document.getElementById('btn-add-service').addEventListener('click', () => {
    addServiceCard();
  });

  document.getElementById('form-alta').addEventListener('submit', handleSubmit);
});

function verifySession() {
  const isAuth = localStorage.getItem('netcontrol_auth');
  if (!isAuth || isAuth !== 'true') {
    window.location.href = '../index.html';
  }
}

function loadUserInfo() {
  const userEmail = localStorage.getItem('netcontrol_user');
  if (userEmail) {
    document.querySelectorAll('.user-email-text').forEach(el => {
      el.textContent = userEmail;
    });
  }
}

/**
 * Añade dinámicamente una nueva card de servicio al contenedor con la estructura exacta de 3 filas
 */
function addServiceCard() {
  const container = document.getElementById('servicios-container');
  const serviceIndex = container.children.length + 1;

  const card = document.createElement('div');
  card.className = 'service-card bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden transition-all';
  
  card.innerHTML = `
    <div class="absolute top-0 left-0 w-1.5 h-full bg-indigo-500"></div>
    <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
      <span class="text-xs font-bold text-indigo-300 flex items-center gap-2">
        <i class="fa-solid fa-cubes"></i> Servicio #${serviceIndex}
      </span>
      ${serviceIndex > 1 ? `
        <button type="button" class="btn-remove-service text-red-400 hover:text-red-300 text-xs flex items-center gap-1 transition">
          <i class="fa-solid fa-trash"></i> Eliminar
        </button>
      ` : ''}
    </div>

    <div class="space-y-4 text-xs">
      
      <!-- FILA 1: Servicio, Tipo Conexión, SSID (condicional), Tipo IP, Dirección IP, Protocolo -->
      <div class="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
        <div>
          <label class="block text-slate-400 mb-1">Servicio *</label>
          <input type="text" name="servicio" required placeholder="Ej. Home Assistant" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Tipo Conexión</label>
          <select name="tipo_conexion" class="tipo-conexion-select w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
            <option value="ETHERNET">ETHERNET</option>
            <option value="WIFI">WIFI</option>
          </select>
        </div>

        <div class="ssid-container hidden">
          <label class="block text-slate-400 mb-1">SSID (Red Wifi)</label>
          <input type="text" name="ssid" placeholder="Ej. HomeIoT" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Tipo IP</label>
          <select name="tipo_ip" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
            <option value="dinamica">DHCP Dinámica</option>
            <option value="estatica">Estática</option>
            <option value="DHCP estatica">DHCP Estática</option>
          </select>
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Dirección IP</label>
          <input type="text" name="ip" placeholder="1.1.1.X" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Protocolo</label>
          <input type="text" name="protocolo" placeholder="Ej. TCP, HTTP" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
        </div>
      </div>

      <!-- FILA 2: Software (Servicio), Puertos Rout, Puertos Dock, Docker Network -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div>
          <label class="block text-slate-400 mb-1">Software</label>
          <input type="text" name="software" placeholder="Ej. Docker" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Puerto Rout Ext ➔ Int</label>
          <div class="flex gap-1">
            <input type="text" name="puerto_rout_ext" placeholder="Ext" class="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
            <input type="text" name="puerto_rout_int" placeholder="Int" class="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
          </div>
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Puerto Dock Ext ➔ Int</label>
          <div class="flex gap-1">
            <input type="text" name="puerto_dock_ext" placeholder="Ext" class="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
            <input type="text" name="puerto_dock_int" placeholder="Int" class="w-1/2 bg-slate-950 border border-slate-800 rounded-xl px-2 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
          </div>
        </div>

        <div>
          <label class="block text-slate-400 mb-1">Docker Network</label>
          <input type="text" name="dock_network" placeholder="Ej. bridge, host" class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500">
        </div>
      </div>

      <!-- FILA 3: Comentarios del Servicio (Ancho completo) -->
      <div>
        <label class="block text-slate-400 mb-1">Comentarios</label>
        <textarea name="comentarios" rows="2" placeholder="Notas específicas sobre este servicio..." class="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-indigo-500"></textarea>
      </div>

    </div>
  `;

  // Lógica para mostrar/ocultar el SSID según el tipo de conexión seleccionado
  const tipoConexionSelect = card.querySelector('.tipo-conexion-select');
  const ssidContainer = card.querySelector('.ssid-container');

  tipoConexionSelect.addEventListener('change', (e) => {
    if (e.target.value === 'WIFI') {
      ssidContainer.classList.remove('hidden');
    } else {
      ssidContainer.classList.add('hidden');
      card.querySelector('[name="ssid"]').value = ''; // Limpiar valor si se oculta
    }
  });

  // Listener para el botón de eliminar card
  const removeBtn = card.querySelector('.btn-remove-service');
  if (removeBtn) {
    removeBtn.addEventListener('click', () => {
      card.remove();
      reindexServiceCards();
    });
  }

  container.appendChild(card);
}

function reindexServiceCards() {
  const cards = document.querySelectorAll('.service-card');
  cards.forEach((card, idx) => {
    const titleSpan = card.querySelector('span');
    if (titleSpan) {
      titleSpan.innerHTML = `<i class="fa-solid fa-cubes"></i> Servicio #${idx + 1}`;
    }
  });
}

/**
 * Maneja el envío del formulario completo a la Edge Function
 */
async function handleSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('btn-submit');
  submitBtn.disabled = true;
  submitBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Guardando...`;

  try {
    // 1. Recoger datos de hardware principales
    const planta = document.getElementById('planta').value;
    const estancia = document.getElementById('estancia').value;
    const hostname = document.getElementById('hostname').value.trim();
    const id_hw = document.getElementById('id_hw').value.trim();
    const mac = document.getElementById('mac').value.trim();
    const software = document.getElementById('software_base').value.trim();
    const comentarios = document.getElementById('comentarios').value.trim();

    // 2. Recoger datos de todas las cards de servicios
    const serviceCards = document.querySelectorAll('.service-card');
    const servicios = [];

    serviceCards.forEach(card => {
      const tipoConexion = card.querySelector('[name="tipo_conexion"]').value;
      const servicioObj = {
        tipo_conexion: tipoConexion,
        ssid: tipoConexion === 'WIFI' ? card.querySelector('[name="ssid"]').value.trim() : null,
        tipo_ip: card.querySelector('[name="tipo_ip"]').value,
        ip: card.querySelector('[name="ip"]').value.trim(),
        servicio: card.querySelector('[name="servicio"]').value.trim(),
        software: card.querySelector('[name="software"]').value.trim(),
        protocolo: card.querySelector('[name="protocolo"]').value.trim(),
        puerto_rout_ext: card.querySelector('[name="puerto_rout_ext"]').value.trim(),
        puerto_rout_int: card.querySelector('[name="puerto_rout_int"]').value.trim(),
        puerto_dock_ext: card.querySelector('[name="puerto_dock_ext"]').value.trim(),
        puerto_dock_int: card.querySelector('[name="puerto_dock_int"]').value.trim(),
        dock_network: card.querySelector('[name="dock_network"]').value.trim(),
        comentarios: card.querySelector('[name="comentarios"]').value.trim()
      };
      servicios.push(servicioObj);
    });

    const payload = {
      planta,
      estancia,
      hostname,
      id_hw,
      mac,
      software,
      comentarios,
      servicios
    };

    // 3. Invocar la Edge Function
    const { data, error } = await supabase.functions.invoke('guardar-dispositivo', {
      body: payload
    });

    if (error) throw new Error(error.message || 'Error al invocar la función.');
    if (data && data.success === false) throw new Error(data.message || 'Error en el servidor.');

    alert('¡Dispositivo y servicios guardados con éxito!');
    document.getElementById('form-alta').reset();
    
    // Opcional: limpiar servicios dinámicos y dejar uno por defecto limpio tras resetear
    document.getElementById('servicios-container').innerHTML = '';
    addServiceCard();

    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Dispositivo y Servicios`;

  } catch (err) {
    console.error('Error al guardar:', err);
    alert(`Error: ${err.message}`);
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Dispositivo y Servicios`;
  }
}
