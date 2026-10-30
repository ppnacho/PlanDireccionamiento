/**
 * NetControl - Lógica de Representación 3D Industrial (Sala de Servidores)
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
 * Obtiene los dispositivos invocando exclusivamente a la Edge Function
 */
async function fetchDevices() {
  try {
    const { data, error } = await supabase.functions.invoke('obtener-dispositivos', {
      method: 'GET'
    });

    if (error) throw new Error(error.message || 'Error de comunicación con el servidor.');
    if (data && data.success === false) throw new Error(data.message || 'No se pudieron recuperar los dispositivos.');

    allDevices = data.devices || [];
    renderIndustrialRacks(allDevices);

  } catch (err) {
    console.error('Error al cargar dispositivos:', err);
    document.getElementById('racks-container').innerHTML = `
      <div class="glass-nav p-6 rounded-xl text-center text-rose-400 text-xs border border-rose-900 font-mono">
        <i class="fa-solid fa-triangle-exclamation text-lg mb-2"></i>
        <p>No se pudo cargar la topología de red: ${err.message}</p>
      </div>
    `;
  }
}

/**
 * Filtro de búsqueda en tiempo real
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
    renderIndustrialRacks(filtered);
  });
}

/**
 * Renderiza los racks con aspecto industrial de chasis de servidor
 */
function renderIndustrialRacks(devices) {
  const container = document.getElementById('racks-container');
  if (!container) return;

  if (devices.length === 0) {
    container.innerHTML = `
      <div class="glass-nav p-8 rounded-xl text-center text-slate-400 text-xs border border-slate-800 font-mono">
        <i class="fa-solid fa-triangle-exclamation text-amber-400 text-lg mb-2"></i>
        <p>No se encontraron dispositivos en el inventario con los criterios de búsqueda.</p>
      </div>
    `;
    return;
  }

  // Orden estricto de las 5 filas de racks
  const targetPlants = ['BAJA', 'ESCALERA 1', 'PRIMERA', 'ESCALERA 2', 'BUHARDILLA'];

  const groupedByPlant = devices.reduce((acc, d) => {
    let planta = (d.planta || 'BAJA').toUpperCase();
    if (!acc[planta]) acc[planta] = [];
    acc[planta].push(d);
    return acc;
  }, {});

  const activePlants = targetPlants.filter(p => groupedByPlant[p] && groupedByPlant[p].length > 0);

  container.innerHTML = activePlants.map(planta => {
    const items = groupedByPlant[planta];

    const groupedByEstancia = items.reduce((acc, d) => {
      const est = d.estancia || 'General';
      if (!acc[est]) acc[est] = [];
      acc[est].push(d);
      return acc;
    }, {});

    return `
      <div class="industrial-rack-row rounded-2xl p-5 shadow-2xl">
        <!-- Cabecera del Chasis de Rack -->
        <div class="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
          <div class="flex items-center gap-3">
            <div class="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center text-xs font-bold border border-blue-500/30 font-mono shadow-inner">
              <i class="fa-solid fa-server"></i>
            </div>
            <div>
              <h3 class="text-xs font-bold text-white uppercase tracking-widest font-mono">RACK CHASSIS // ZONA: ${planta}</h3>
              <span class="text-[10px] text-slate-400 font-mono">Unidades de rack ocupadas y monitorización activa</span>
            </div>
          </div>
          <span class="text-[10px] font-mono bg-slate-950 text-blue-400 px-3 py-1 rounded-lg border border-slate-800 shadow-inner">
            ${items.length} ${items.length === 1 ? 'módulo' : 'módulos'} activos
          </span>
        </div>

        <!-- Estancias como bandejas modulares -->
        <div class="space-y-3.5">
          ${Object.entries(groupedByEstancia).map(([estancia, dispositivos]) => `
            <div class="bg-slate-950/70 rounded-xl p-3.5 border border-slate-800/80 shadow-inner">
              <div class="text-[11px] font-bold text-slate-300 uppercase tracking-wide mb-2.5 flex items-center gap-2 font-mono">
                <i class="fa-solid fa-location-dot text-blue-400 text-xs"></i> <span>Estancia: ${estancia}</span>
              </div>

              <!-- Blades de Servidor (Hardware Nodes) -->
              <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                ${dispositivos.map(d => {
                  const isWifi = d.tipo_conexion === 'WIFI';
                  const ledConnClass = isWifi ? 'led-status-blue' : 'led-status-green';
                  const connText = isWifi ? 'WIFI' : 'ETH';

                  const isStatic = d.tipo_ip === 'estatica' || d.tipo_ip === 'DHCP estatica';
                  const ledIpClass = isStatic ? 'led-status-green' : 'led-status-amber';

                  const displayName = d.hostname || d.id_hw;

                  return `
                    <div onclick='openBladeModal(${JSON.stringify(d)})' class="hardware-blade rounded-xl p-3 flex items-center justify-between gap-3">
                      <div class="flex items-center gap-3 min-w-0">
                        <!-- Panel de LEDs estilo hardware real -->
                        <div class="flex flex-col gap-2 shrink-0 bg-slate-900/80 p-1.5 rounded border border-slate-800" title="LED 1: Red (${connText}) | LED 2: Estado IP">
                          <span class="w-2 h-2 rounded-full ${ledConnClass} led-activity"></span>
                          <span class="w-2 h-2 rounded-full ${ledIpClass}"></span>
                        </div>
                        <div class="min-w-0">
                          <div class="text-xs font-bold text-white font-mono truncate tracking-tight" title="${displayName}">
                            ${displayName}
                          </div>
                          <div class="text-[10px] text-emerald-400 font-mono truncate">
                            <i class="fa-solid fa-globe text-[9px] mr-1"></i>${d.ip || 'DHCP Dinámica'}
                          </div>
                        </div>
                      </div>
                      <div class="shrink-0 text-right">
                        <span class="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-900 text-slate-300 border border-slate-800 uppercase font-semibold">
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

// Modal interactivo de diagnóstico (Burbuja Blade)
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
      <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
        <span class="text-slate-500 block text-[10px] uppercase">RED Y PUERTOS MAPEADOS</span>
        <span class="text-slate-200 text-xs">${portsInfo || 'Sin mapeo de puertos'} ${device.dock_network ? `<br><span class="text-indigo-400 font-bold">Docker Net: ${device.dock_network}</span>` : ''}</span>
      </div>
    `;
  }

  if ((device.servicio && device.servicio.length > 0) || (device.software && device.software.length > 0)) {
    extraHtml += `
      <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
        <span class="text-slate-500 block text-[10px] uppercase">SERVICIOS & SOFTWARE ACTIVO</span>
        <div class="flex flex-wrap gap-1.5">
          ${device.servicio ? device.servicio.map(s => `<span class="text-[10px] bg-slate-900 text-blue-300 px-2 py-0.5 rounded-md border border-slate-800 font-semibold">${s}</span>`).join('') : ''}
          ${device.software ? device.software.map(sw => `<span class="text-[10px] bg-indigo-950/80 text-indigo-300 px-2 py-0.5 rounded-md border border-indigo-900/80 font-semibold">${sw}</span>`).join('') : ''}
        </div>
      </div>
    `;
  }

  if (device.comentarios) {
    extraHtml += `
      <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
        <span class="text-slate-500 block text-[10px] uppercase">COMENTARIOS TÉCNICOS</span>
        <span class="text-amber-300/90 italic text-xs">${device.comentarios}</span>
      </div>
    `;
  }

  extraSection.innerHTML = extraHtml;
  document.getElementById('blade-modal').classList.remove('hidden');
};

window.closeModal = function() {
  document.getElementById('blade-modal').classList.add('hidden');
};
