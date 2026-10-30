/**
 * NetControl - Lógica de Representación 3D (Sala de Servidores y Racks)
 * Acceso estrictamente mediante Edge Functions.
 */
import { supabase } from './supabaseClient.js';

let allDevices = [];

document.addEventListener('DOMContentLoaded', () => {
  verifySession();
  loadUserInfo();
  fetchDevices();
  setupSearchFilter();
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

window.handleLogout = function() {
  localStorage.removeItem('netcontrol_auth');
  localStorage.removeItem('netcontrol_user');
  window.location.href = '../index.html';
};

/**
 * Obtiene los dispositivos invocando a la Edge Function correspondiente
 */
async function fetchDevices() {
  try {
    const { data, error } = await supabase.functions.invoke('obtener-dispositivos', {
      method: 'GET'
    });

    if (error) throw new Error(error.message || 'Error de comunicación con el servidor.');
    if (data && data.success === false) throw new Error(data.message || 'No se pudieron recuperar los dispositivos.');

    allDevices = data.devices || [];
    renderDeviceRacks(allDevices);

  } catch (err) {
    console.error('Error al cargar dispositivos:', err);
    document.getElementById('racks-container').innerHTML = `
      <div class="glass-nav p-6 rounded-xl text-center text-rose-400 text-xs border border-rose-900">
        <i class="fa-solid fa-triangle-exclamation text-lg mb-2"></i>
        <p>No se pudo cargar la topología de red: ${err.message}</p>
      </div>
    `;
  }
}

/**
 * Filtra dispositivos en tiempo real
 */
function setupSearchFilter() {
  const searchInput = document.getElementById('search-device');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = allDevices.filter(d => 
      (d.hostname && d.hostname.toLowerCase().includes(term)) ||
      (d.id_hw && d.id_hw.toLowerCase().includes(term)) ||
      (d.ip && d.ip.toLowerCase().includes(term)) ||
      (d.mac && d.mac.toLowerCase().includes(term)) ||
      (d.planta && d.planta.toLowerCase().includes(term)) ||
      (d.estancia && d.estancia.toLowerCase().includes(term))
    );
    renderDeviceRacks(filtered);
  });
}

/**
 * Renderiza los dispositivos agrupados en las 5 filas de racks
 */
function renderDeviceRacks(devices) {
  const container = document.getElementById('racks-container');
  if (!container) return;

  if (devices.length === 0) {
    container.innerHTML = `
      <div class="glass-nav p-8 rounded-xl text-center text-slate-400 text-xs border border-slate-800">
        <i class="fa-solid fa-triangle-exclamation text-amber-400 text-lg mb-2"></i>
        <p>No se encontraron dispositivos en el inventario con los criterios de búsqueda.</p>
      </div>
    `;
    return;
  }

  // Orden estricto de las 5 filas de racks
  const targetPlants = ['BAJA', 'ESCALERA 1', 'PRIMERA', 'ESCALERA 2', 'BUHARDILLA'];

  // Agrupar por planta
  const groupedByPlant = devices.reduce((acc, d) => {
    let planta = (d.planta || 'BAJA').toUpperCase();
    if (!acc[planta]) acc[planta] = [];
    acc[planta].push(d);
    return acc;
  }, {});

  const activePlants = targetPlants.filter(p => groupedByPlant[p] && groupedByPlant[p].length > 0);

  container.innerHTML = activePlants.map(planta => {
    const items = groupedByPlant[planta];

    // Agrupar por estancia dentro de la planta
    const groupedByEstancia = items.reduce((acc, d) => {
      const est = d.estancia || 'General';
      if (!acc[est]) acc[est] = [];
      acc[est].push(d);
      return acc;
    }, {});

    return `
      <div class="server-rack rounded-xl p-4 sm:p-5 shadow-2xl">
        <!-- Cabecera del Rack / Fila -->
        <div class="flex items-center justify-between mb-4 pb-2.5 border-b border-slate-700/80">
          <div class="flex items-center gap-3">
            <div class="w-7 h-7 rounded bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-500/30 font-mono">
              <i class="fa-solid fa-server"></i>
            </div>
            <div>
              <h3 class="text-xs font-bold text-white uppercase tracking-wider font-mono">ZONA DE RACK: ${planta}</h3>
              <span class="text-[10px] text-slate-400 font-mono">Distribución física de chasis y nodos</span>
            </div>
          </div>
          <span class="text-[10px] font-mono bg-slate-900/90 text-blue-400 px-2.5 py-1 rounded-full border border-slate-800">
            ${items.length} ${items.length === 1 ? 'dispositivo' : 'dispositivos'}
          </span>
        </div>

        <!-- Estancias como sub-bandejas de rack -->
        <div class="space-y-3">
          ${Object.entries(groupedByEstancia).map(([estancia, dispositivos]) => `
            <div class="bg-slate-900/60 rounded-lg p-3 border border-slate-800/80">
              <div class="text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-2 flex items-center gap-1.5 font-mono">
                <i class="fa-solid fa-location-dot text-blue-400 text-[10px]"></i> ${estancia}
              </div>

              <!-- Blades de servidores en la estancia -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                ${dispositivos.map(d => {
                  const isWifi = d.tipo_conexion === 'WIFI';
                  const ledConnClass = isWifi ? 'led-blue' : 'led-green';
                  const connText = isWifi ? 'WIFI' : 'ETH';

                  const isStatic = d.tipo_ip === 'estatica' || d.tipo_ip === 'DHCP estatica';
                  const ledIpClass = isStatic ? 'led-green' : 'led-amber';

                  const displayName = d.hostname || d.id_hw;

                  return `
                    <div onclick='openBladeModal(${JSON.stringify(d)})' class="server-blade rounded p-2.5 flex items-center justify-between gap-2">
                      <div class="flex items-center gap-2.5 min-w-0">
                        <div class="flex flex-col gap-1.5 shrink-0" title="LED 1: Red (${connText}) | LED 2: IP">
                          <span class="w-2 h-2 rounded-full ${ledConnClass}"></span>
                          <span class="w-2 h-2 rounded-full ${ledIpClass}"></span>
                        </div>
                        <div class="min-w-0">
                          <div class="text-xs font-bold text-white font-mono truncate" title="${displayName}">
                            ${displayName}
                          </div>
                          <div class="text-[10px] text-slate-400 font-mono truncate">
                            ${d.ip || 'DHCP Dinámica'}
                          </div>
                        </div>
                      </div>
                      <div class="shrink-0 text-right">
                        <span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 uppercase">
                          ${d.tipo_conexion}
                        </span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');
}

// Modal interactivo de las Blades
window.openBladeModal = function(device) {
  document.getElementById('modal-title').textContent = device.id_hw || 'Sin ID';
  document.getElementById('modal-hostname').textContent = device.hostname ? `@${device.hostname}` : 'Sin hostname';
  document.getElementById('modal-ip').textContent = device.ip || 'DHCP Dinámica';
  document.getElementById('modal-mac').textContent = device.mac || 'N/D';
  document.getElementById('modal-ubicacion').textContent = `${device.planta} / ${device.estancia}`;
  document.getElementById('modal-conexion').textContent = `${device.tipo_conexion} ${device.ssid ? '(' + device.ssid + ')' : ''} [${device.tipo_ip}]`;

  const extraSection = document.getElementById('modal-extra-section');
  let extraHtml = '';

  const portsInfo = [
    device.puerto_rout_ext ? `Rout Ext: ${device.puerto_rout_ext}➔${device.puerto_rout_int || '?'}` : '',
    device.puerto_dock_int ? `Dock Int: ${device.puerto_dock_int}` : '',
    device.puerto_dock_ext ? `Dock Ext: ${device.puerto_dock_ext}` : ''
  ].filter(Boolean).join(' | ');

  if (portsInfo || device.dock_network) {
    extraHtml += `
      <div class="bg-slate-900/80 p-2.5 rounded border border-slate-800">
        <span class="text-slate-500 block text-[10px]">RED Y PUERTOS</span>
        <span class="text-slate-300">${portsInfo || 'Sin mapeo de puertos'} ${device.dock_network ? `<br><span class="text-indigo-400">Docker: ${device.dock_network}</span>` : ''}</span>
      </div>
    `;
  }

  if ((device.servicio && device.servicio.length > 0) || (device.software && device.software.length > 0)) {
    extraHtml += `
      <div class="bg-slate-900/80 p-2.5 rounded border border-slate-800 space-y-1">
        <span class="text-slate-500 block text-[10px]">SERVICIOS & SOFTWARE</span>
        <div class="flex flex-wrap gap-1">
          ${device.servicio ? device.servicio.map(s => `<span class="text-[9px] bg-slate-800 text-blue-300 px-1.5 py-0.5 rounded border border-slate-700">${s}</span>`).join('') : ''}
          ${device.software ? device.software.map(sw => `<span class="text-[9px] bg-indigo-950 text-indigo-300 px-1.5 py-0.5 rounded border border-indigo-900">${sw}</span>`).join('') : ''}
        </div>
      </div>
    `;
  }

  if (device.comentarios) {
    extraHtml += `
      <div class="bg-slate-900/80 p-2.5 rounded border border-slate-800">
        <span class="text-slate-500 block text-[10px]">COMENTARIOS</span>
        <span class="text-amber-300/90 italic">${device.comentarios}</span>
      </div>
    `;
  }

  extraSection.innerHTML = extraHtml;
  document.getElementById('blade-modal').classList.remove('hidden');
};

window.closeModal = function() {
  document.getElementById('blade-modal').classList.add('hidden');
};
