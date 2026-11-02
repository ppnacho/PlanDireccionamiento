/**
 * NetControl - Lógica de Alta y Edición Normalizada (Dispositivo + Múltiples Servicios)
 */
import { supabase } from './supabaseClient.js';

let editDeviceId = null; // Variable global para almacenar el ID si estamos editando

document.addEventListener('DOMContentLoaded', async () => {
  verifySession();
  loadUserInfo();

  // Comprobar si hay un ID en la URL para el modo edición
  const urlParams = new URLSearchParams(window.location.search);
  editDeviceId = urlParams.get('id');

  if (editDeviceId) {
    // Modo Edición
    document.querySelector('h1').textContent = 'Editar Dispositivo y Servicios';
    const submitBtn = document.getElementById('btn-submit');
    if (submitBtn) submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar Cambios`;
    
    await cargarDatosParaEdicion(editDeviceId);
  } else {
    // Modo Alta (Añadir un servicio por defecto)
    addServiceCard();
  }

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
 * Carga los datos del dispositivo y sus servicios para rellenar el formulario en modo edición
 */
async function cargarDatosParaEdicion(id) {
  try {
    // Invocamos la Edge Function pasando el ID como parámetro GET
    const { data, error } = await supabase.functions.invoke(`edita-dispositivo?id=${id}`, {
      method: 'GET'
    });

    if (error) throw new Error(error.message || 'Error de comunicación con el servidor.');
    if (data && data.success === false) throw new Error(data.message || 'No se pudo recuperar el dispositivo.');

    const dispositivo = data.device;
    if (!dispositivo) throw new Error('Dispositivo no encontrado.');

    // 1. Rellenar campos principales del hardware
    document.getElementById('planta').value = dispositivo.planta || '';
    document.getElementById('hostname').value = dispositivo.hostname || '';
    document.getElementById('id_hw').value = dispositivo.id_hw || '';
    document.getElementById('mac').value = dispositivo.mac || '';
    document.getElementById('software_base').value = dispositivo.software || '';
    document.getElementById('comentarios').value = dispositivo.comentarios || '';

    // Asignación inteligente para la estancia (soporta tanto input como select)
    const estanciaEl = document.getElementById('estancia');
    if (estanciaEl) {
      const valEstancia = (dispositivo.estancia || '').trim();
      if (estanciaEl.tagName === 'SELECT') {
        let matched = false;
        for (let option of estanciaEl.options) {
          if (option.value.toUpperCase() === valEstancia.toUpperCase() || option.text.toUpperCase() === valEstancia.toUpperCase()) {
            estanciaEl.value = option.value;
            matched = true;
            break;
          }
        }
        // Si no estaba en las opciones, la añadimos dinámicamente para que no se quede en blanco
        if (!matched && valEstancia) {
          const newOpt = document.createElement('option');
          newOpt.value = valEstancia;
          newOpt.textContent = valEstancia;
          estanciaEl.appendChild(newOpt);
          estanciaEl.value = valEstancia;
        }
      } else {
        estanciaEl.value = valEstancia;
      }
    }

    // 2. Rellenar tarjetas de servicios
    const servicios = dispositivo.servicios_red || [];
    const container = document.getElementById('servicios-container');
    container.innerHTML = ''; 

    if (servicios.length === 0) {
      addServiceCard();
    } else {
      servicios.forEach((serv) => {
        addServiceCard(serv);
      });
    }

  } catch (err) {
    console.error('Error al cargar dispositivo para editar:', err);
    alert(`No se pudieron cargar los datos: ${err.message}`);
  }
}

/**
 * Añade dinámicamente una nueva card clonando la plantilla HTML (admite datos opcionales para edición)
 */
function addServiceCard(servData = null) {
  const container = document.getElementById('servicios-container');
  const template = document.getElementById('service-card-template');
  const clone = template.content.cloneNode(true);
  
  const card = clone.querySelector('.service-card');
  const serviceIndex = container.children.length + 1;

  // Configurar título del servicio
  card.querySelector('.service-title').innerHTML = `<i class="fa-solid fa-cubes"></i> Servicio #${serviceIndex}`;

  // Gestionar visibilidad del botón de eliminar (solo si hay más de 1 servicio)
  const removeBtn = card.querySelector('.btn-remove-service');
  
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

  // Si pasamos datos de servicio (modo edición), rellenar los inputs
  if (servData) {
    tipoConexionSelect.value = servData.tipo_conexion || 'ETHERNET';
    if (servData.tipo_conexion === 'WIFI') {
      ssidContainer.classList.remove('hidden');
      card.querySelector('[name="ssid"]').value = servData.ssid || '';
    }
    card.querySelector('[name="tipo_ip"]').value = servData.tipo_ip || 'dinamica';
    card.querySelector('[name="ip"]').value = servData.ip || '';
    card.querySelector('[name="servicio"]').value = servData.servicio || '';
    card.querySelector('[name="software"]').value = servData.software || '';
    card.querySelector('[name="protocolo"]').value = servData.protocolo || '';
    card.querySelector('[name="puerto_rout_ext"]').value = servData.puerto_rout_ext || '';
    card.querySelector('[name="puerto_rout_int"]').value = servData.puerto_rout_int || '';
    card.querySelector('[name="puerto_dock_ext"]').value = servData.puerto_dock_ext || '';
    card.querySelector('[name="puerto_dock_int"]').value = servData.puerto_dock_int || '';
    card.querySelector('[name="dock_network"]').value = servData.dock_network || '';
    card.querySelector('[name="comentarios"]').value = servData.comentarios || '';
  }

  // Configurar botón de eliminar card
  updateRemoveButtonsState();
  removeBtn.addEventListener('click', () => {
    card.remove();
    reindexServiceCards();
    updateRemoveButtonsState();
  });

  container.appendChild(card);
}

function updateRemoveButtonsState() {
  const cards = document.querySelectorAll('.service-card');
  cards.forEach((card, idx) => {
    const removeBtn = card.querySelector('.btn-remove-service');
    if (cards.length === 1) {
      removeBtn.style.display = 'none'; // No se puede eliminar si solo queda 1
    } else {
      removeBtn.style.display = 'inline-flex';
    }
  });
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
 * Maneja el envío del formulario completo a la Edge Function (Alta o Edición)
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
      id: editDeviceId || null, // Incluye el ID si estamos editando
      planta,
      estancia,
      hostname,
      id_hw,
      mac,
      software,
      comentarios,
      servicios
    };

    // 3. SELECCIÓN DE LA EDGE FUNCTION SEGÚN EL MODO (AQUÍ ESTÁ EL CAMBIO CLAVE)
    // Si editDeviceId tiene valor -> llama a 'edita-dispositivo'
    // Si es null / vacío -> llama a la de alta 'guardar-dispositivo'
    const endpoint = editDeviceId ? 'edita-dispositivo' : 'guardar-dispositivo';

    const { data, error } = await supabase.functions.invoke(endpoint, {
      body: payload
    });

    if (error) throw new Error(error.message || 'Error al invocar la función.');
    if (data && data.success === false) throw new Error(data.message || 'Error en el servidor.');

    alert(editDeviceId ? '¡Dispositivo actualizado con éxito!' : '¡Dispositivo y servicios guardados con éxito!');
    
    // 4. ACCIÓN POST-GUARDADO
    if (editDeviceId) {
      window.location.href = 'representacion_3d.html'; // Al editar, volvemos al 3D
    } else {
      document.getElementById('form-alta').reset(); // Al dar de alta, limpiamos para seguir creando
      document.getElementById('servicios-container').innerHTML = '';
      addServiceCard();
    }

    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar`;

  } catch (err) {
    console.error('Error al guardar:', err);
    alert(`Error: ${err.message}`);
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<i class="fa-solid fa-floppy-disk"></i> Guardar`;
  }
}
