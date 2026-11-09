/**
 * NetControl - Lógica de Visualización de Topología de Red con Vis.js
 * Infraestructura base fija y limpia + Icono tasmota (esp8266.png).
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
    // INFRAESTRUCTURA BASE FIJA (Sin etiquetas)
    // ==========================================

    // 1. Nodo Internet (InternetWan)
    nodesArray.push({
      id: 'internet',
      label: undefined,
      shape: 'image',
      image: '../assets/img/InternetWan.png',
      size: 32,
      x: -350, y: 150, fixed: { x: true, y: true }
    });

    // 2. Router Principal (routerinet)
    nodesArray.push({
      id: 'router_internet',
      label: undefined,
      shape: 'image',
      image: '../assets/img/routerinet.png',
      size: 30,
      x: -120, y: 150, fixed: { x: true, y: true }
    });
    edgesArray.push({ from: 'internet', to: 'router_internet', color: { color: '#38bdf8' }, width: 3 });

    // 3. Router Salón / Domo (routerdomo)
    nodesArray.push({
      id: 'router_salon',
      label: undefined,
      shape: 'image',
      image: '../assets/img/routerdomo.png',
      size: 28,
      x: 120, y: 150, fixed: { x: true, y: true }
    });
    edgesArray.push({ from: 'router_internet', to: 'router_salon', color: { color: '#6366f1' }, width: 2 });

    // 4. Switch Planta Baja (switchtroncal)
    nodesArray.push({
      id: 'switch_pb',
      label: undefined,
      shape: 'image',
      image: '../assets/img/switchtroncal.png',
      size: 30,
      x: -120, y: 30, fixed: { x: true, y: true }
    });
    edgesArray.push({ from: 'router_internet', to: 'switch_pb', color: { color: '#2dd4bf' }, width: 2 });

    // 5. Switch Planta Primera (switchtroncal - Enlace 10GbE más ancho)
    nodesArray.push({
      id: 'switch_p1',
      label: undefined,
      shape: 'image',
      image: '../assets/img/switchtroncal.png',
      size: 30,
      x: -120, y: -100, fixed: { x: true, y: true }
    });
    edgesArray.push({ from: 'switch_pb', to: 'switch_p1', color: { color: '#f59e0b' }, width: 6 });

    // 6. Switch Buhardilla (switchtroncal - Enlace 10GbE más ancho)
    nodesArray.push({
      id: 'switch_buhar',
      label: undefined,
      shape: 'image',
      image: '../assets/img/switchtroncal.png',
      size: 30,
      x: -120, y: -240, fixed: { x: true, y: true }
    });
    edgesArray.push({ from: 'switch_p1', to: 'switch_buhar', color: { color: '#f59e0b' }, width: 6 });

    // 7. Switch Secundario Buhardilla (switchfinal)
    nodesArray.push({
      id: 'switch_buhar_sec',
      label: undefined,
      shape: 'image',
      image: '../assets/img/switchfinal.png',
      size: 26,
      x: 120, y: -240, fixed: { x: true, y: true }
    });
    edgesArray.push({ from: 'switch_buhar', to: 'switch_buhar_sec', color: { color: '#2dd4bf' }, width: 2 });

    // 8. AP Buhardilla (Usa routerap.png)
    nodesArray.push({
      id: 'ap_buhar',
      label: undefined,
      shape: 'image',
      image: '../assets/img/routerap.png',
      size: 26,
      x: 320, y: -240, fixed: { x: true, y: true }
    });
    edgesArray.push({ from: 'switch_buhar_sec', to: 'ap_buhar', color: { color: '#6366f1' }, width: 2 });

    // 9. Switch Garaje (switchfinal)
    nodesArray.push({
      id: 'switch_garaje',
      label: undefined,
      shape: 'image',
      image: '../assets/img/switchfinal.png',
      size: 26,
      x: -120, y: 280, fixed: { x: true, y: true }
    });
    edgesArray.push({ from: 'router_internet', to: 'switch_garaje', color: { color: '#2dd4bf' }, width: 2 });

    // 10. Router AP Garaje (Usa routerap.png)
    nodesArray.push({
      id: 'ap_garaje',
      label: undefined,
      shape: 'image',
      image: '../assets/img/routerap.png',
      size: 26,
      x: -300, y: 280, fixed: { x: true, y: true }
    });
    edgesArray.push({ from: 'switch_garaje', to: 'ap_garaje', color: { color: '#6366f1' }, width: 2 });


    // ==========================================
    // DISPOSITIVOS DINÁMICOS DE LA BBDD (Agrupados por SSID sin líneas visibles)
    // ==========================================
    dispositivos.forEach(dev => {
      if (dev.hostname && !nodesArray.some(n => n.id === dev.id)) {
        const servicios = dev.servicios_red || [];
        const primaryServ = servicios[0] || {};
        const isWifi = primaryServ.tipo_conexion === 'WIFI';
        const ssid = primaryServ.ssid ? primaryServ.ssid.toLowerCase() : '';
        
        const software = (dev.software || dev.firmware || dev.tipo || '').toLowerCase();
        const isTasmota = software.includes('tasmota');

        let parentNodeId = 'switch_pb'; 

        if (isWifi || isTasmota) {
          if (ssid.includes('buhar')) {
            parentNodeId = 'ap_buhar';
          } else if (ssid.includes('devicesg') || ssid.includes('garaje')) {
            parentNodeId = 'ap_garaje';
          } else {
            parentNodeId = 'router_salon'; // Por defecto al router del salón / domo
          }
        } else {
          const planta = (dev.planta || '').toUpperCase();
          if (planta.includes('BUHAR')) parentNodeId = 'switch_buhar';
          else if (planta.includes('PRIMERA')) parentNodeId = 'switch_p1';
          else if (planta.includes('GARAJE')) parentNodeId = 'switch_garaje';
        }

        let nodeShape = 'dot';
        let nodeImage = undefined;
        let nodeSize = 10;
        let nodeColor = { background: '#10b981', border: '#34d399' };

        if (isTasmota) {
          nodeShape = 'image';
          nodeImage = '../assets/img/esp8266.png';
          nodeSize = 18;
          nodeColor = undefined;
        } else if (isWifi) {
          nodeShape = 'image';
          nodeImage = 'https://img.icons8.com/fluency/48/wi-fi.png';
          nodeSize: 16;
          nodeColor = undefined;
        }

        // Crear el nodo del dispositivo
        nodesArray.push({
          id: dev.id,
          label: `${dev.hostname}\n(${primaryServ.ip || dev.ip || 'DHCP'})`,
          shape: nodeShape,
          image: nodeImage,
          size: nodeSize,
          color: nodeColor,
          font: { color: '#cbd5e1', face: 'monospace', size: 10, background: '#020617' }
        });

        if (!isWifi && !isTasmota) {
          // Dispositivos cableados: línea discontinua visible hacia su switch
          edgesArray.push({
            from: parentNodeId,
            to: dev.id,
            color: { color: '#334155' },
            width: 1,
            dashes: true
          });
        } else {
          // Dispositivos Wi-Fi y Tasmota: Enlace invisible físico para que la gravedad los agrupe
          // alrededor de su AP/Router emisor sin pintar ninguna línea.
          edgesArray.push({
            from: parentNodeId,
            to: dev.id,
            color: { opacity: 0 }, // Completamente transparente
            width: 0,
            length: 90            // Distancia de órbita alrededor del nodo emisor
          });
        }
      }
    });

    const nodes = new vis.DataSet(nodesArray);
    const edges = new vis.DataSet(edgesArray);

    const dataContainer = { nodes, edges };
    const options = {
      nodes: { borderWidth: 2, shadow: true },
      edges: {
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
