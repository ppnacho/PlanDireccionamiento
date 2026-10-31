/**
 * NetControl - Motor WebGL 3D Avanzado (Three.js) - Subracks delimitados por estancias (Borde Amarillo)
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
  scene.fog = new THREE.FogExp2(0x020408, 0.02);

  const width = container.clientWidth || window.innerWidth;
  const height = container.clientHeight || (window.innerHeight - 73);

  camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
  camera.position.set(0, 4, 16);

  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(width, height);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  container.appendChild(renderer.domElement);

  controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.maxPolarAngle = Math.PI / 2 - 0.02; 
  controls.minDistance = 3;
  controls.maxDistance = 40;

  // Iluminación general de sala
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
  dirLight.position.set(10, 30, 20);
  scene.add(dirLight);

  const roomLight = new THREE.PointLight(0x3b82f6, 3, 40);
  roomLight.position.set(0, 10, 0);
  scene.add(roomLight);

  // Suelo técnico
  const floorGeo = new THREE.PlaneGeometry(60, 60);
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x0b1329, 
    roughness: 0.7, 
    metalness: 0.3 
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.5;
  scene.add(floor);

  const gridHelper = new THREE.GridHelper(60, 40, 0x3b82f6, 0x1e293b);
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
 * Crea una textura compacta adaptada a la altura reducida
 */
function createBladeTexture(device) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 80;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);

  const img = new Image();
  img.src = '../assets/img/blade_front.png';
  img.onload = () => {
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    // LED 1 (Conexión)
    const isWifi = device.tipo_conexion === 'WIFI';
    ctx.fillStyle = isWifi ? '#38bdf8' : '#22c55e';
    ctx.beginPath();
    ctx.arc(22, 40, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // LED 2 (Tipo IP)
    const isStatic = device.tipo_ip === 'estatica' || device.tipo_ip === 'DHCP estatica';
    ctx.fillStyle = isStatic ? '#22c55e' : '#f59e0b';
    ctx.beginPath();
    ctx.arc(38, 40, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Recuadro de fondo gris con esquinas redondeadas
    ctx.fillStyle = '#cbd5e1'; 
    ctx.strokeStyle = '#64748b'; 
    ctx.lineWidth = 1.2;

    ctx.beginPath();
    ctx.roundRect(50, 22, 192, 36, 5);
    ctx.fill();
    ctx.stroke();

    // Hostname en color negro y legible
    ctx.fillStyle = '#000000';
    ctx.font = '15px monospace';
    const displayName = device.hostname || device.id_hw || 'Nodo';
    ctx.fillText(displayName, 58, 45);

    texture.needsUpdate = true;
  };

  return texture;
}

/**
 * Construye la sala técnica 3D con subracks delimitados por un marco amarillo
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

  plantConfig.forEach((rowConfig, rowIndex) => {
    const rowDevices = groupedByPlant[rowConfig.name] || [];
    const zPos = (rowIndex - 2) * 4.5;

    const groupedByEstancia = rowDevices.reduce((acc, d) => {
      const est = (d.estancia || 'General').toUpperCase();
      if (!acc[est]) acc[est] = [];
      acc[est].push(d);
      return acc;
    }, {});

    const estanciasKeys = Object.keys(groupedByEstancia);

    for (let r = 0; r < rowConfig.racks; r++) {
      const rackCenterX = rowConfig.racks === 2 ? (r === 0 ? -2.0 : 2.0) : 0;

      // Chasis del Rack Físico
      const rackGeo = new THREE.BoxGeometry(3.4, 4.4, 1.2);
      const rackMat = new THREE.MeshStandardMaterial({ 
        color: 0x0f172a, 
        roughness: 0.3, 
        metalness: 0.85 
      });
      const rackMesh = new THREE.Mesh(rackGeo, rackMat);
      rackMesh.position.set(rackCenterX, 0, zPos);
      scene.add(rackMesh);

      let rackEstancias = [];
      if (rowConfig.racks === 2) {
        rackEstancias = estanciasKeys.filter((_, idx) => idx % 2 === r);
      } else {
        rackEstancias = estanciasKeys;
      }

      let globalDeviceIndex = 0;

      rackEstancias.forEach(estanciaName => {
        const estanciaDevices = groupedByEstancia[estanciaName] || [];
        if (estanciaDevices.length === 0) return;

        const startIndex = globalDeviceIndex;
        estanciaDevices.forEach(() => {
          globalDeviceIndex++;
        });
        const endIndex = globalDeviceIndex - 1;

        // Calcular la posición y altura del subrack amarillo en función de las filas que ocupa
        const startRow = Math.floor(startIndex / 2);
        const endRow = Math.floor(endIndex / 2);
        const numRows = (endRow - startRow) + 1;

        const subrackHeight = (numRows * 0.38) + 0.1;
        const topRowY = 1.6 - (startRow * 0.38);
        const bottomRowY = 1.6 - (endRow * 0.38);
        const subrackCenterY = (topRowY + bottomRowY) / 2 + 0.05;

        // Dibujar el marco o contenedor del Subrack en color amarillo brillante
        const subrackBoxGeo = new THREE.BoxGeometry(3.15, subrackHeight, 0.04);
        const subrackMat = new THREE.MeshStandardMaterial({
          color: 0xeab308, // Amarillo brillante (Tailwind yellow-500)
          emissive: 0xeab308,
          emissiveIntensity: 0.4,
          roughness: 0.2,
          wireframe: true // Crea un efecto de rejilla/borde tecnológico muy limpio
        });
        const subrackMesh = new THREE.Mesh(subrackBoxGeo, subrackMat);
        subrackMesh.position.set(rackCenterX, subrackCenterY, zPos + 0.54);
        scene.add(subrackMesh);
        rackMeshes.push(subrackMesh);

        // Renderizar las blades de esta estancia dentro de su espacio asignado
        estanciaDevices.forEach((device, dIdx) => {
          const absoluteIdx = startIndex + dIdx;
          const col = absoluteIdx % 2; 
          const rowIdx = Math.floor(absoluteIdx / 2);

          const xPos = rackCenterX + (col === 0 ? -0.78 : 0.78);
          const yOffset = 1.6 - (rowIdx * 0.38);

          const bladeGeo = new THREE.BoxGeometry(1.4, 0.27, 0.08);
          const bladeMat = new THREE.MeshStandardMaterial({ 
            map: createBladeTexture(device),
            emissive: 0xffffff,
            emissiveMap: createBladeTexture(device),
            emissiveIntensity: 0.25,
            roughness: 0.2
          });

          const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
          bladeMesh.position.set(xPos, yOffset, zPos + 0.58);
          
          bladeMesh.userData = device;
          scene.add(bladeMesh);
          rackMeshes.push(bladeMesh);
        });
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
