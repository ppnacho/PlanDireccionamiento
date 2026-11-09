/**
 * NetControl - Lógica de Visualización de Topología de Red con Vis.js
 * Infraestructura base fija, Wi-Fi agrupado invisible y cableado en formato Bus Ethernet.
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
    // DISPOSITIVOS DINÁMICOS DE LA BBDD (Bus Horizontal y Hover en Etiquetas)
    // ==========================================

    const busConfigs = {
      'switch_pb':    { x: -120, y: 30,  left: -220, right: -20 },
      'switch_p1':    { x: -120, y: -100, left: -220, right: -20 },
      'switch_buhar': { x: -120, y: -240, left: -220, right: -20 },
      'switch_garaje':{ x: -120, y: 280,  left: -220, right: -20 }
    };

    const cableadosPorSwitch = {
      'switch_pb': [],
      'switch_p1': [],
      'switch_buhar': [],
      'switch_garaje': []
    };

    dispositivos.forEach(dev => {
      if (dev.hostname && !nodesArray.some(n => n.id === dev.id)) {
        const servicios = dev.servicios_red || [];
        const primaryServ = servicios[0] || {};
        const isWifi = primaryServ.tipo_conexion === 'WIFI';
        const ssid = primaryServ.ssid ? primaryServ.ssid.toLowerCase() : '';
        
        const software = (dev.software || dev.firmware || dev.tipo || '').toLowerCase();
        const isTasmota = software.includes('tasmota');

        let parentNodeId = 'switch_pb'; 
        const infoTexto = `${dev.hostname}\n(${primaryServ.ip || dev.ip || 'DHCP'})`;

        if (isWifi || isTasmota) {
          if (ssid.includes('buhar')) {
            parentNodeId = 'ap_buhar';
          } else if (ssid.includes('devicesg') || ssid.includes('garaje')) {
            parentNodeId = 'ap_garaje';
          } else {
            parentNodeId = 'router_salon'; 
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
            nodeSize = 16;
            nodeColor = undefined;
          }

          nodesArray.push({
            id: dev.id,
            label: undefined, // Oculto por defecto
            title: infoTexto,  // Se muestra al pasar el ratón (tooltip)
            shape: nodeShape,
            image: nodeImage,
            size: nodeSize,
            color: nodeColor
          });

          edgesArray.push({
            from: parentNodeId,
            to: dev.id,
            color: { opacity: 0 },
            width: 0,
            length: 90
          });

        } else {
          const planta = (dev.planta || '').toUpperCase();
          if (planta.includes('BUHAR')) parentNodeId = 'switch_buhar';
          else if (planta.includes('PRIMERA')) parentNodeId = 'switch_p1';
          else if (planta.includes('GARAJE')) parentNodeId = 'switch_garaje';
          else if (planta.includes('BAJA')) parentNodeId = 'switch_pb';

          if (!cableadosPorSwitch[parentNodeId]) {
            cableadosPorSwitch[parentNodeId] = [];
          }
          cableadosPorSwitch[parentNodeId].push({ dev, primaryServ, infoTexto });
        }
      }
    });

    // Construcción del Bus Ethernet horizontal con los dispositivos limpios
    Object.keys(cableadosPorSwitch).forEach(switchId => {
      const listaDevs = cableadosPorSwitch[switchId];
      if (listaDevs.length === 0) return;

      const cfg = busConfigs[switchId];
      const busIzqId = `bus_izq_${switchId}`;
      const busDerId = `bus_der_${switchId}`;

      nodesArray.push(
        { id: busIzqId, label: undefined, shape: 'dot', size: 1, color: { opacity: 0 }, x: cfg.left, y: cfg.y, fixed: { x: true, y: true } },
        { id: busDerId, label: undefined, shape: 'dot', size: 1, color: { opacity: 0 }, x: cfg.right, y: cfg.y, fixed: { x: true, y: true } }
      );

      edgesArray.push({
        from: busIzqId,
        to: busDerId,
        color: { color: '#0284c7' },
        width: 4,
        dashes: false
      });

      edgesArray.push({
        from: switchId,
        to: busIzqId,
        color: { color: '#0284c7' },
        width: 2,
        dashes: false
      });

      const step = (cfg.right - cfg.left) / (listaDevs.length + 1);

      listaDevs.forEach((item, index) => {
        const devId = item.dev.id;
        const posX = cfg.left + step * (index + 1);
        const posY = cfg.y + (index % 2 === 0 ? -65 : 65);

        // Dispositivo cableado en el bus con etiqueta oculta y tooltip al pasar el ratón
        nodesArray.push({
          id: devId,
          label: undefined, // Oculto por defecto para mantener el esquema limpio
          title: item.infoTexto, // Información emergente al pasar el cursor
          shape: 'dot',
          size: 10,
          color: { background: '#0ea5e9', border: '#38bdf8' },
          x: posX,
          y: posY,
          fixed: { x: true, y: true }
        });

        const tapId = `tap_${devId}`;
        nodesArray.push({
          id: tapId,
          label: undefined,
          shape: 'dot',
          size: 1,
          color: { opacity: 0 },
          x: posX,
          y: cfg.y,
          fixed: { x: true, y: true }
        });

        edgesArray.push({
          from: tapId,
          to: devId,
          color: { color: '#0284c7' },
          width: 2,
          dashes: false
        });
      });
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
