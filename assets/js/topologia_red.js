/**
 * NetControl - Lógica de Visualización de Topología de Red con Vis.js
 * Distribución base fija con escalado dinámico para dispositivos conectados.
 */
import { supabase } from './supabaseClient.js';

let network = null;

document.addEventListener('DOMContentLoaded', async () => {
  verifySession();
  await loadNetworkTopology();
});

function verifySession() {
  const isAuth = localStorage.getItem('netcontrol_auth');
  if (!isAuth || isAuth !== 'true') {
    window.location.href = '../index.html';
  }
}

/**
 * Carga la topología manteniendo el patrón maestro y escalando los dispositivos dinámicos
 */
window.loadNetworkTopology = async function() {
  const container = document.getElementById('network-container');
  container.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-slate-400 font-mono text-xs italic bg-slate-950/80 z-20"><i class="fa-solid fa-spinner fa-spin mr-2 text-blue-400 text-base"></i> Generando topología de red...</div>`;

  try {
    const { data, error } = await supabase.functions.invoke('obtener-dispositivos', {
      method: 'GET'
    });

    if (error) throw new Error(error.message || 'Error de comunicación.');
    if (data && data.success === false) throw new Error(data.message);

    const dispositivos = data.devices || [];

    const nodesArray = [];
    const edgesArray = [];

    // ==========================================
    // INFRAESTRUCTURA BASE FIJA (Con iconos locales)
    // ==========================================

    // 1. Nodo Internet (InternetWan)
    nodesArray.push({
      id: 'internet',
      label: 'INTERNET\n(WAN)',
      shape: 'image',
      image: '../assets/img/InternetWan.png',
      size: 32,
      x: -350, y: 150, fixed: { x: true, y: true },
      font: { color: '#38bdf8', face: 'monospace', size: 12, background: '#020617' }
    });

    // 2. Router Principal (routerinet)
    nodesArray.push({
      id: 'router_internet',
      label: 'Router Principal',
      shape: 'image',
      image: '../assets/img/routerinet.png',
      size: 30,
      x: -120, y: 150, fixed: { x: true, y: true },
      font: { color: '#f8fafc', face: 'monospace', size: 11, background: '#020617' }
    });
    edgesArray.push({ from: 'internet', to: 'router_internet', color: { color: '#38bdf8' }, width: 3 });

    // 3. Router Salón / Domo (routerdomo)
    nodesArray.push({
      id: 'router_salon',
      label: 'Router Salón\n(salon2.4, 5, devices)',
      shape: 'image',
      image: '../assets/img/routerdomo.png',
      size: 28,
      x: 120, y: 150, fixed: { x: true, y: true },
      font: { color: '#818cf8', face: 'monospace', size: 11, background: '#020617' }
    });
    edgesArray.push({ from: 'router_internet', to: 'router_salon', color: { color: '#6366f1' }, width: 2, label: 'Wi-Fi' });

    // 4. Switch Planta Baja (switchtroncal)
    nodesArray.push({
      id: 'switch_pb',
      label: 'Switch Planta Baja',
      shape: 'image',
      image: '../assets/img/switchtroncal.png',
      size: 30,
      x: -120, y: 30, fixed: { x: true, y: true },
      font: { color: '#2dd4bf', face: 'monospace', size: 11, background: '#020617' }
    });
    edgesArray.push({ from: 'router_internet', to: 'switch_pb', color: { color: '#2dd4bf' }, width: 2, label: '2.5GbE' });

    // 5. Switch Planta Primera (switchtroncal - Enlace 10GbE más ancho)
    nodesArray.push({
      id: 'switch_p1',
      label: 'Switch Primera',
      shape: 'image',
      image: '../assets/img/switchtroncal.png',
      size: 30,
      x: -120, y: -100, fixed: { x: true, y: true },
      font: { color: '#2dd4bf', face: 'monospace', size: 11, background: '#020617' }
    });
    edgesArray.push({ from: 'switch_pb', to: 'switch_p1', color: { color: '#f59e0b' }, width: 6, label: '10GbE Troncal' });

    // 6. Switch Buhardilla (switchtroncal - Enlace 10GbE más ancho)
    nodesArray.push({
      id: 'switch_buhar',
      label: 'Switch Buhardilla',
      shape: 'image',
      image: '../assets/img/switchtroncal.png',
      size: 30,
      x: -120, y: -240, fixed: { x: true, y: true },
      font: { color: '#2dd4bf', face: 'monospace', size: 11, background: '#020617' }
    });
    edgesArray.push({ from: 'switch_p1', to: 'switch_buhar', color: { color: '#f59e0b' }, width: 6, label: '10GbE Troncal' });

    // 7. Switch Secundario Buhardilla (switchfinal)
    nodesArray.push({
      id: 'switch_buhar_sec',
      label: 'Switch Secundario',
      shape: 'image',
      image: '../assets/img/switchfinal.png',
      size: 26,
      x: 120, y: -240, fixed: { x: true, y: true },
      font: { color: '#cbd5e1', face: 'monospace', size: 10, background: '#020617' }
    });
    edgesArray.push({ from: 'switch_buhar', to: 'switch_buhar_sec', color: { color: '#2dd4bf' }, width: 2, label: '2.5GbE' });

    // 8. AP Buhardilla (Usa routerap.png)
    nodesArray.push({
      id: 'ap_buhar',
      label: 'AP Buhardilla\n(buhar2.4, buhar5)',
      shape: 'image',
      image: '../assets/img/routerap.png',
      size: 26,
      x: 320, y: -240, fixed: { x: true, y: true },
      font: { color: '#818cf8', face: 'monospace', size: 10, background: '#020617' }
    });
    edgesArray.push({ from: 'switch_buhar_sec', to: 'ap_buhar', color: { color: '#6366f1' }, width: 2, label: 'Wi-Fi' });

    // 9. Switch Garaje (switchfinal)
    nodesArray.push({
      id: 'switch_garaje',
      label: 'Switch Garaje',
      shape: 'image',
      image: '../assets/img/switchfinal.png',
      size: 26,
      x: -120, y: 280, fixed: { x: true, y: true },
      font: { color: '#cbd5e1', face: 'monospace', size: 10, background: '#020617' }
    });
    edgesArray.push({ from: 'router_internet', to: 'switch_garaje', color: { color: '#2dd4bf' }, width: 2 });

    // 10. Router AP Garaje (Usa routerap.png)
    nodesArray.push({
      id: 'ap_garaje',
      label: 'Router AP Garaje\n(devicesg)',
      shape: 'image',
      image: '../assets/img/routerap.png',
      size: 26,
      x: -300, y: 280, fixed: { x: true, y: true },
      font: { color: '#818cf8', face: 'monospace', size: 10, background: '#020617' }
    });
    edgesArray.push({ from: 'switch_garaje', to: 'ap_garaje', color: { color: '#6366f1' }, width: 2, label: 'Wi-Fi' });


    // ==========================================
    // DISPOSITIVOS DINÁMICOS DE LA BBDD (Escalables)
    // ==========================================
    dispositivos.forEach(dev => {
      if (dev.hostname && !nodesArray.some(n => n.id === dev.id)) {
        const servicios = dev.servicios_red || [];
        const primaryServ = servicios[0] || {};
        const isWifi = primaryServ.tipo_conexion === 'WIFI';
        const ssid = primaryServ.ssid ? primaryServ.ssid.toLowerCase() : '';

        // Enrutar al nodo de infraestructura correspondiente
        let parentNodeId = 'switch_pb'; 

        if (isWifi) {
          if (ssid.includes('buhar')) {
            parentNodeId = 'ap_buhar';
          } else if (ssid.includes('devicesg') || ssid.includes('garaje')) {
            parentNodeId = 'ap_garaje';
          } else {
            parentNodeId = 'router_salon'; 
          }
        } else {
          const planta = (dev.planta || '').toUpperCase();
          if (planta.includes('BUHAR')) parentNodeId = 'switch_buhar';
          else if (planta.includes('PRIMERA')) parentNodeId = 'switch_p1';
          else if (planta.includes('GARAJE')) parentNodeId = 'switch_garaje';
        }

        // Crear nodo dinámico (con icono wifi si es inalámbrico o punto verde si es cableado)
        nodesArray.push({
          id: dev.id,
          label: `${dev.hostname}\n(${primaryServ.ip || dev.ip || 'DHCP'})`,
          shape: isWifi ? 'image' : 'dot',
          image: isWifi ? 'https://img.icons8.com/fluency/48/wi-fi.png' : undefined,
          size: isWifi ? 16 : 10,
          color: isWifi ? undefined : { background: '#10b981', border: '#34d399' },
          font: { color: '#cbd5e1', face: 'monospace', size: 10, background: '#020617' }
        });

        // Conexión al switch/AP correspondiente
        edgesArray.push({
          from: parentNodeId,
          to: dev.id,
          color: { color: isWifi ? '#6366f1' : '#334155' },
          width: 1,
          dashes: !isWifi
        });
      }
    });

    const nodes = new vis.DataSet(nodesArray);
    const edges = new vis.DataSet(edgesArray);

    const dataContainer = { nodes, edges };
    const options = {
      nodes: { borderWidth: 2, shadow: true },
      edges: {
        font: { color: '#94a3b8', size: 9, align: 'middle', background: '#020617' },
        shadow: true,
        smooth: { type: 'cubicBezier', roundness: 0.2 }
      },
      physics: {
        barnesHut: {
          gravitationalConstant: -2500,
          centralGravity: 0.05,
          springLength: 80,
          springConstant: 0.03,
          damping: 0.09
        }
      },
      interaction: { hover: true, zoomView: true }
    };

    container.innerHTML = '';
    network = new vis.Network(container, dataContainer, options);

  } catch (err) {
    console.error('Error al cargar la topología:', err);
    container.innerHTML = `<div class="absolute inset-0 flex items-center justify-center text-red-400 font-mono text-xs bg-slate-950/90 z-20">Error al cargar el esquema: ${err.message}</div>`;
  }
};
