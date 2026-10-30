/**
 * NetControl - Motor WebGL 3D Avanzado (Three.js) con Texturas Dinámicas (Hostnames y LEDs)
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

/**
 * Inicializa el entorno 3D Three.js
 */
function init3DEnvironment() {
  const container = document.getElementById('webgl-container');
  if (!container) return;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x020408);
  scene.fog = new THREE.FogExp2(0x020408, 0.03);

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || (window.innerHeight - 73);

  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
  camera.position.set(0, 5, 18);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; 
  controls.minDistance = 4;
  controls.maxDistance = 40;

  // Iluminación de Sala Técnica
  const ambientLight = new THREE.AmbientLight(0x1e293b, 1.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x38bdf8, 1.5);
  dirLight.position.set(15, 25, 15);
  scene.add(dirLight);

  // Suelo técnico tipo baldosas de Data Center
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x070b12, 
    roughness: 0.8, 
    metalness: 0.2 
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.5;
  scene.add(floor);

  const gridHelper = new THREE.GridHelper(60, 40, 0x2563eb, 0x1e293b);
  gridHelper.position.y = -2.48;
  scene.add(gridHelper);

  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  renderer.domElement.addEventListener('click', onCanvasClick);
  window.addEventListener('resize', onWindowResize);

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
    buildDataCenterRoom(allDevices);

  } catch (err) {
    console.error('Error al cargar dispositivos 3D:', err);
    buildDataCenterRoom([]);
  }
}

/**
 * Crea una textura dinámica en Canvas pintando únicamente los LEDs y el Hostname
 */
function createBladeTexture(device) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');

  // Fondo metálico oscuro de la blade
  ctx.fillStyle = '#111827';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Borde técnico y ranuras de ventilación simuladas
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, canvas.width - 6, canvas.height - 6);

  // LED 1 (Conexión: Wifi = Azul, Eth = Verde)
  const isWifi = device.tipo_conexion === 'WIFI';
  ctx.fillStyle = isWifi ? '#38bdf8' : '#22c55e';
  ctx.beginPath();
  ctx.arc(35, 64, 12, 0, Math.PI * 2);
  ctx.fill();

  // LED 2 (Tipo IP: Estática = Verde, Dinámica = Ámbar)
  const isStatic = device.tipo_ip === 'estatica' || device.tipo_ip === 'DHCP estatica';
  ctx.fillStyle = isStatic ? '#22c55e' : '#f59e0b';
  ctx.beginPath();
  ctx.arc(75, 64, 12, 0, Math.PI * 2);
  ctx.fill();

  // Texto: Hostname principal (centrado verticalmente)
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 42px monospace';
  const displayName = device.hostname || device.id_hw || 'Nodo Sin ID';
  ctx.fillText(displayName, 115, 76);

  const texture = new THREE.CanvasTexture(canvas);
  return texture;
}

/**
 * Construye la sala técnica 3D con 5 filas de racks (2 racks por planta, 1 en escaleras)
 */
function buildDataCenterRoom(devices) {
  rackMeshes.forEach(m => scene.remove(m));
  rackMeshes = [];

  const plantConfig = [
    { name: 'BAJA', racks: 2 },
    { name: 'ESCALERA 1', racks: 1 },
    { name: 'PRIMERA', racks: 2 },
    { name: 'ESCALERA 2', racks: 1 },
    { name: 'BUHARDILLA', racks: 2 }
  ];

  const groupedByPlant = devices.reduce((acc, d) => {
    let planta = (d.planta || 'BAJA').toUpperCase();
    if (!acc[planta]) acc[planta] = [];
    acc[planta].push(d);
    return acc;
  }, {});

  plantConfig.forEach((row, rowIndex) => {
    const rowDevices = groupedByPlant[row.name] || [];
    const zPos = (rowIndex - 2) * 4.2;

    for (let r = 0; r < row.racks; r++) {
      const xPos = row.racks === 2 ? (r === 0 ? -1.8 : 1.8) : 0;

      const rackGeo = new THREE.BoxGeometry(3.2, 4.2, 1.1);
      const rackMat = new THREE.MeshStandardMaterial({ 
        color: 0x0f172a, 
        roughness: 0.3, 
        metalness: 0.85 
      });
      const rackMesh = new THREE.Mesh(rackGeo, rackMat);
      rackMesh.position.set(xPos, 0, zPos);
      scene.add(rackMesh);

      const rackDevices = row.racks === 2 
        ? rowDevices.filter((_, idx) => idx % 2 === r) 
        : rowDevices;

      const displayItems = rackDevices.length > 0 ? rackDevices : [];

      displayItems.forEach((device, dIndex) => {
        if (dIndex >= 7) return;
        const yOffset = 1.4 - (dIndex * 0.55);

        const bladeGeo = new THREE.BoxGeometry(2.9, 0.45, 0.9);
        const bladeMat = new THREE.MeshStandardMaterial({ 
          map: createBladeTexture(device),
          roughness: 0.2,
          metalness: 0.5
        });

        const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
        bladeMesh.position.set(xPos, yOffset, zPos + 0.08);
        
        bladeMesh.userData = device;
        scene.add(bladeMesh);
        rackMeshes.push(bladeMesh);
      });
    }
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
