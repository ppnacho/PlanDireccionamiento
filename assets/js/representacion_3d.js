/**
 * NetControl - Motor WebGL 3D para Sala de Servidores (Three.js)
 * Acceso estrictamente mediante la Edge Function 'obtener-dispositivos'.
 */
import { supabase } from './supabaseClient.js';

let allDevices = [];
let scene, camera, renderer, controls;
let rackMeshes = []; 
let raycaster, mouse;

document.addEventListener('DOMContentLoaded', () => {
  verifySession();
  loadUserInfo();
  init3DEnvironment();
  fetchDevices();
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
 * Inicializa el motor gráfico Three.js garantizando el tamaño correcto
 */
function init3DEnvironment() {
  const container = document.getElementById('webgl-container');
  if (!container) return;

  // 1. Escena y Cámara
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020408);
  scene.fog = new THREE.FogExp2(0x020408, 0.035);

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || (window.innerHeight - 73);

  camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 1000);
  camera.position.set(0, 6, 14);

  // 2. Renderizador WebGL
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  // 3. Controles de Órbita
  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.05; 
  controls.minDistance = 4;
  controls.maxDistance = 40;

  // 4. Iluminación
  const ambientLight = new THREE.AmbientLight(0x334155, 1.8);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
  dirLight.position.set(10, 25, 15);
  scene.add(dirLight);

  const pointLight = new THREE.PointLight(0x3b82f6, 3, 25);
  pointLight.position.set(0, 8, 0);
  scene.add(pointLight);

  // 5. Suelo técnico y rejilla
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x070b12, 
    roughness: 0.9, 
    metalness: 0.1 
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2;
  scene.add(floor);

  const gridHelper = new THREE.GridHelper(60, 40, 0x2563eb, 0x1e293b);
  gridHelper.position.y = -1.98;
  scene.add(gridHelper);

  // 6. Detección de clics
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('click', onCanvasClick);

  window.addEventListener('resize', onWindowResize);

  // Forzar un renderizado inicial inmediato
  animate();
}

function animate() {
  requestAnimationFrame(animate);
  if (controls) controls.update();
  if (renderer && scene && camera) {
    renderer.render(scene, camera);
  }
}

function onWindowResize() {
  const container = document.getElementById('webgl-container');
  if (!container || !renderer || !camera) return;
  
  const width = container.clientWidth;
  const height = container.clientHeight;
  
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  renderer.setSize(width, height);
}

/**
 * Obtiene los dispositivos mediante la Edge Function
 */
async function fetchDevices() {
  try {
    const { data, error } = await supabase.functions.invoke('obtener-dispositivos', {
      method: 'GET'
    });

    if (error) throw new Error(error.message || 'Error de comunicación con el servidor.');
    if (data && data.success === false) throw new Error(data.message || 'No se pudieron recuperar los dispositivos.');

    allDevices = data.devices || [];
    build3DRacks(allDevices);

  } catch (err) {
    console.error('Error al cargar dispositivos 3D:', err);
    // Si falla la red, al menos dibujamos racks vacíos para comprobar que el 3D funciona
    build3DRacks([]);
  }
}

/**
 * Construye las 5 filas de racks en la escena 3D WebGL
 */
function build3DRacks(devices) {
  rackMeshes.forEach(m => scene.remove(m));
  rackMeshes = [];

  const targetPlants = ['BAJA', 'ESCALERA 1', 'PRIMERA', 'ESCALERA 2', 'BUHARDILLA'];

  const groupedByPlant = devices.reduce((acc, d) => {
    let planta = (d.planta || 'BAJA').toUpperCase();
    if (!acc[planta]) acc[planta] = [];
    acc[planta].push(d);
    return acc;
  }, {});

  targetPlants.forEach((plantaName, index) => {
    const items = groupedByPlant[plantaName] || [];
    const zPos = (index - 2) * 3.8; // Posicionamiento en profundidad de las 5 filas

    // Chasis exterior del Rack 3D (Estructura metálica)
    const rackGeo = new THREE.BoxGeometry(2.6, 3.4, 0.9);
    const rackMat = new THREE.MeshStandardMaterial({ 
      color: 0x0f172a, 
      roughness: 0.3, 
      metalness: 0.85 
    });
    const rackMesh = new THREE.Mesh(rackGeo, rackMat);
    rackMesh.position.set(0, 0, zPos);
    scene.add(rackMesh);
    rackMeshes.push(rackMesh);

    // Si no hay dispositivos en esta planta, creamos un bloque vacío representativo
    const renderItems = items.length > 0 ? items : [{ id_hw: `Rack Vacío (${plantaName})`, tipo_conexion: 'ETH', tipo_ip: 'estatica' }];

    renderItems.forEach((device, dIndex) => {
      const yOffset = 1.1 - (dIndex * 0.45);
      
      const bladeGeo = new THREE.BoxGeometry(2.3, 0.35, 0.8);
      const isWifi = device.tipo_conexion === 'WIFI';
      const bladeMat = new THREE.MeshStandardMaterial({ 
        color: isWifi ? 0x1d4ed8 : 0x047857, 
        roughness: 0.2, 
        metalness: 0.6,
        emissive: isWifi ? 0x1e3a8a : 0x065f46,
        emissiveIntensity: 0.2
      });
      const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
      bladeMesh.position.set(0, Math.max(yOffset, -1.2), zPos + 0.05);
      
      bladeMesh.userData = device.id ? device : null; // Solo interactivo si es un dispositivo real de BD
      scene.add(bladeMesh);
      if (device.id) rackMeshes.push(bladeMesh);
    });
  });
}

function onCanvasClick(event) {
  const container = document.getElementById('webgl-container');
  if (!container) return;

  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / container.clientWidth) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / container.clientHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(rackMeshes);

  if (intersects.length > 0) {
    const clickedObj = intersects[0].object;
    if (clickedObj.userData && clickedObj.userData.id_hw) {
      openBladeModal(clickedObj.userData);
    }
  }
}

window.openBladeModal = function(device) {
  document.getElementById('modal-title').textContent = device.id_hw || 'Sin ID';
  document.getElementById('modal-hostname').textContent = device.hostname ? `@${device.hostname}` : 'Sin hostname';
  document.getElementById('modal-ip').textContent = device.ip || 'DHCP Dinámica';
  document.getElementById('modal-mac').textContent = device.mac || 'N/D';
  document.getElementById('modal-ubicacion').textContent = `${device.planta} / ${device.estancia || 'General'}`;
  document.getElementById('modal-conexion').textContent = `${device.tipo_conexion} ${device.ssid ? '(' + device.ssid + ')' : ''} [${device.tipo_ip}]`;

  const extraSection = document.getElementById('modal-extra-section');
  let extraHtml = '';

  const portsInfo = [
    device.puerto_rout_ext ? `Rout Ext: ${device.puerto_rout_ext}➔${device.puerto_rout_int || '?'}` : '',
    device.puerto_dock_int ? `Dock Int: ${device.puerto_dock_int}` : ''
  ].filter(Boolean).join(' | ');

  if (portsInfo || device.dock_network) {
    extraHtml += `
      <div class="bg-slate-950 p-3 rounded-xl border border-slate-800">
        <span class="text-slate-500 block text-[10px] uppercase">RED Y PUERTOS</span>
        <span class="text-slate-200 text-xs">${portsInfo || 'Sin mapeo'} ${device.dock_network ? `<br><span class="text-indigo-400 font-bold">Docker: ${device.dock_network}</span>` : ''}</span>
      </div>
    `;
  }

  if ((device.servicio && device.servicio.length > 0) || (device.software && device.software.length > 0)) {
    extraHtml += `
      <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5">
        <span class="text-slate-500 block text-[10px] uppercase">SERVICIOS & SOFTWARE</span>
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
        <span class="text-slate-500 block text-[10px] uppercase">COMENTARIOS</span>
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
