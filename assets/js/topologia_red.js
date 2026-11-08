/**
 * NetControl - Lógica de Visualización de Topología de Red con Vis.js
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
 * Consulta los dispositivos a través de la Edge Function 'obtener-dispositivos' y dibuja el grafo
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

    // 1. Nodo Raíz / Internet (Planta Baja)
    nodesArray.push({
      id: 'internet',
      label: 'INTERNET\n(WAN)',
      shape: 'ellipse',
      color: { background: '#0284c7', border: '#38bdf8', highlight: { background: '#0369a1', border: '#bae6fd' } },
      font: { color: '#ffffff', face: 'monospace', size: 12 }
    });

    // 2. Router Principal (Planta Baja - WiFi off)
    nodesArray.push({
      id: 'router_internet',
      label: 'Router Principal\n(Planta Baja)',
      shape: 'box',
      color: { background: '#1e293b', border: '#475569', highlight: { background: '#334155', border: '#64748b' } },
      font: { color: '#f8fafc', face: 'monospace', size: 12 },
      margin: 10
    });
    edgesArray.push({ from: 'internet', to: 'router_internet', color: { color: '#38bdf8' }, width: 3 });

    // 3. Router Salón (WiFi: salon2.4, salon5, devices)
    nodesArray.push({
      id: 'router_salon',
      label: 'Router Salón\n(salon2.4, salon5, devices)',
      shape: 'box',
      color: { background: '#312e81', border: '#6366f1', highlight: { background: '#3730a3', border: '#818cf8' } },
      font: { color: '#f8fafc', face: 'monospace', size: 11 },
      margin: 10
    });
    edgesArray.push({ from: 'router_internet', to: 'router_salon', color: { color: '#6366f1' }, width: 2 });

    // 4. Switch Principal 2.5GbE (Planta Baja)
    nodesArray.push({
      id: 'switch_pb',
      label: 'Switch 10p 2.5GbE\n(Planta Baja)',
      shape: 'box',
      color: { background: '#0f766e', border: '#2dd4bf', highlight: { background: '#115e59', border: '#5eead4' } },
      font: { color: '#f8fafc', face: 'monospace', size: 11 },
      margin: 10
    });
    edgesArray.push({ from: 'router_internet', to: 'switch_pb', color: { color: '#2dd4bf' }, width: 3, label: '2.5GbE' });

    // 5. Switch Planta Primera (10GbE Link)
    nodesArray.push({
      id: 'switch_p1',
      label: 'Switch 10GbE\n(Planta Primera)',
      shape: 'box',
      color: { background: '#0f766e', border: '#2dd4bf', highlight: { background: '#115e59', border: '#5eead4' } },
      font: { color: '#f8fafc', face: 'monospace', size: 11 },
      margin: 10
    });
    edgesArray.push({ from: 'switch_pb', to: 'switch_p1', color: { color: '#f59e0b' }, width: 4, label: '10GbE Troncal' });

    // 6. Switch Buhardilla (10GbE Link)
    nodesArray.push({
      id: 'switch_buhar',
      label: 'Switch 10GbE\n(Buhardilla)',
      shape: 'box',
      color: { background: '#0f766e', border: '#2dd4bf', highlight: { background: '#115e59', border: '#5eead4' } },
      font: { color: '#f8fafc', face: 'monospace', size: 11 },
      margin: 10
    });
    edgesArray.push({ from: 'switch_p1', to: 'switch_buhar', color: { color: '#f59e0b' }, width: 4, label: '10GbE Troncal' });

    // 7. Switch Secundario 8p Gigabit (Buhardilla)
    nodesArray.push({
      id: 'switch_buhar_sec',
      label: 'Switch 8p Giga\n(Buhardilla)',
      shape: 'box',
      color: { background: '#1e293b', border: '#475569', highlight: { background: '#334155', border: '#64748b' } },
      font: { color: '#f8fafc', face: 'monospace', size: 11 },
      margin: 10
    });
    edgesArray.push({ from: 'switch_buhar', to: 'switch_buhar_sec', color: { color: '#2dd4bf' }, width: 2, label: '2.5GbE' });

    // 8. AP Buhardilla (buhar2.4, buhar5)
    nodesArray.push({
      id: 'ap_buhar',
      label: 'AP Buhardilla\n(buhar2.4, buhar5)',
      shape: 'box',
      color: { background: '#312e81', border: '#6366f1', highlight: { background: '#3730a3', border: '#818cf8' } },
      font: { color: '#f8fafc', face: 'monospace', size: 11 },
      margin: 10
    });
    edgesArray.push({ from: 'switch_buhar_sec', to: 'ap_buhar', color: { color: '#6366f1' }, width: 2 });

    // 9. Switch Garaje (8p Gigabit)
    nodesArray.push({
      id: 'switch_garaje',
      label: 'Switch 8p Giga\n(Garaje)',
      shape: 'box',
      color: { background: '#1e293b', border: '#475569', highlight: { background: '#334155', border: '#64748b' } },
      font: { color: '#f8fafc', face: 'monospace', size: 11 },
      margin: 10
    });
    edgesArray.push({ from: 'router_internet', to: 'switch_garaje', color: { color: '#2dd4bf' }, width: 2 });

    // 10. Router / AP Garaje (devicesg)
    nodesArray.push({
      id: 'ap_garaje',
      label: 'Router AP Garaje\n(devicesg)',
      shape: 'box',
      color: { background: '#312e81', border: '#6366f1', highlight: { background: '#3730a3', border: '#818cf8' } },
      font: { color: '#f8fafc', face: 'monospace', size: 11 },
      margin: 10
    });
    edgesArray.push({ from: 'switch_garaje', to: 'ap_garaje', color: { color: '#6366f1' }, width: 2 });

    // Inyectar dispositivos registrados en la BBDD
    dispositivos.forEach(dev => {
      if (dev.hostname && !nodesArray.some(n => n.id === dev.id)) {
        nodesArray.push({
          id: dev.id,
          label: `${dev.hostname}\n(${dev.ip || 'DHCP'})`,
          shape: 'dot',
          size: 10,
          color: { background: '#10b981', border: '#34d399' },
          font: { color: '#cbd5e1', face: 'monospace', size: 10 }
        });
        edgesArray.push({ from: 'switch_pb', to: dev.id, color: { color: '#1e293b' }, width: 1, dashes: true });
      }
    });

    const nodes = new vis.DataSet(nodesArray);
    const edges = new vis.DataSet(edgesArray);

    const dataContainer = { nodes, edges };
    const options = {
      nodes: { borderWidth: 2, shadow: true },
      edges: {
        font: { color: '#94a3b8', size: 10, align: 'middle', background: '#020617' },
        shadow: true,
        smooth: { type: 'cubicBezier', roundness: 0.2 }
      },
      physics: {
        barnesHut: {
          gravitationalConstant: -3000,
          centralGravity: 0.3,
          springLength: 90,
          springConstant: 0.04,
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
