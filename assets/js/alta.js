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
 * Añade dinámicamente una nueva card clonando la plantilla HTML
 */
function addServiceCard() {
  const container = document.getElementById('servicios-container');
  const template = document.getElementById('service-card-template');
  const clone = template.content.cloneNode(true);
  
  const card = clone.querySelector('.service-card');
  const serviceIndex = container.children.length + 1;

  // Configurar título del servicio
  card.querySelector('.service-title').innerHTML = `<i class="fa-solid fa-cubes"></i> Servicio #${serviceIndex}`;

  // Gestionar visibilidad del botón de eliminar (solo si hay más de 1 servicio)
  const removeBtn = card.querySelector('.btn-remove-service');
  if (serviceIndex === 1) {
    removeBtn.remove(); // El primer servicio no se puede eliminar
  } else {
    removeBtn.addEventListener('click', () => {
      card.remove();
      reindexServiceCards();
    });
  }

  // Lógica para mostrar/ocultar el SSID según el tipo de conexión
  const tipoConexionSelect = card.querySelector('.tipo-conexion-select');
  const ssidContainer = card.querySelector('.ssid-container');

  tipoConexionSelect.addEventListener('change', (e) => {
    if (e.target.value === 'WIFI') {
      ssidContainer.classList.remove('hidden');
    } else {
      ssidContainer.classList.add('hidden');
      card.querySelector('[name="ssid"]').value = '';
    }
  });

  container.appendChild(card);
}

function reindexServiceCards() {
  const cards = document.querySelectorAll('.service-card');
  cards.forEach((card, idx) => {
    const titleSpan = card.querySelector('.service-title');
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
    
    document.getElementById('servicios-container').innerHTML = '';
    addServiceCard();

    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar`;

  } catch (err) {
    console.error('Error al guardar:', err);
    alert(`Error: ${err.message}`);
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar`;
  }
}
