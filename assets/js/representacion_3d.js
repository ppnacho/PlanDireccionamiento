/**
 * NetControl - Motor WebGL 3D Avanzado (Three.js) - Versión Definitiva con Marcos Perimetrales Gruesos y Secuenciales
 * Acceso estrictamente mediante la Edge Function 'obtener-dispositivos'.
 */
import { supabase } from './supabaseClient.js';

let allDevices = [];
let scene, camera, renderer, controls;
let rackMeshes = []; 
let raycaster, mouse;

// Diccionario maestro definitivo con los colores fijos y exclusivos para cada una de nuestras 14 estancias oficiales
const ROOM_COLORS = {
  'COCINA':        { hex: '#f97316', value: 0xf97316 }, // Naranja
  'ASEO':          { hex: '#006400', value: 0x006400 }, // DarkGreen
  'SALON':         { hex: '#ffff38', value: 0xffff38 }, // Amarillo
  'HALL':          { hex: '#a855f7', value: 0xa855f7 }, // Púrpura
  'JARDIN':        { hex: '#00ffff', value: 0x00ffff }, // Aqua
  'ENTRADA':       { hex: '#c0c0c0', value: 0xc0c0c0 }, // Silver
  'GARAJE':        { hex: '#3b82f6', value: 0x3b82f6 }, // AzulMedio
  'TENDEDERO':     { hex: '#ff00ff', value: 0xff00ff }, // Fuchsia
  'HABPPAL':       { hex: '#0000ff', value: 0x0000ff }, // Azul
  'BAÑOPPAL':      { hex: '#ff0000', value: 0xff0000 }, // Rojo
  'BANOPPAL':      { hex: '#ff0000', value: 0xff0000 }, // Variante sin tilde
  'HABDOBLE':      { hex: '#84cc16', value: 0x84cc16 }, // Lima
  'BAÑO':          { hex: '#00ff00', value: 0x00ff00 }, // Lima2
  'BANO':          { hex: '#00ff00', value: 0x00ff00 }, // Variante sin tilde
  'HABINDIVIDUAL': { hex: '#eab308', value: 0xeab308 }, // Amarillo
  'BUHARDILLA':    { hex: '#8b4513', value: 0x8b4513 }, // SaddleBrown
  'GENERAL':       { hex: '#fffaf0', value: 0xfffaf0 }  // FloralWhite
};

// Cargador de texturas para la rejilla trasera del rack
const textureLoader = new THREE.TextureLoader();
const rackMeshTexture = textureLoader.load('../assets/img/rack_mesh.png', (texture) => {
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(3, 4);
});

/**
 * Normaliza y obtiene el objeto de color exacto para cualquier estancia
 */
function getRoomColor(estanciaName) {
  if (!estanciaName) return ROOM_COLORS['GENERAL'];
  const normKey = estanciaName.toString()
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");

  return ROOM_COLORS[normKey] || { hex: '#6366f1', value: 0x6366f1 };
}

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
  controls.minDistance = 3;
  controls.maxDistance = 45;

  // Iluminación general de sala
  const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0x38bdf8, 2.0);
  dirLight.position.set(10, 30, 20);
  scene.add(dirLight);

  const roomLight = new THREE.PointLight(0x3b82f6, 3, 50);
  roomLight.position.set(0, 10, 0);
  scene.add(roomLight);

  // Suelo técnico
  const floorGeo = new THREE.PlaneGeometry(70, 70);
  const floorMat = new THREE.MeshStandardMaterial({ 
    color: 0x0b1329, 
    roughness: 0.7, 
    metalness: 0.3 
  });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -2.5;
  scene.add(floor);

  const gridHelper = new THREE.GridHelper(70, 45, 0x3b82f6, 0x1e293b);
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
 * Genera la textura superior del rack mostrando exclusivamente el texto limpio de la planta (sin recuadros)
 */
function createPlantHeaderTexture(plantName) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 55px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 14;
  ctx.fillText(plantName.toUpperCase(), canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * Crea la textura frontal fotorrealista de cada blade con tipografía legible
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
 * Crea un marco perimetral 3D con grosor visible e independiente de las limitaciones de línea de WebGL
 */
function createSubrackFrameMesh(width, height, thickness, colorValue) {
  const group = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: colorValue });

  const halfW = width / 2;
  const halfH = height / 2;

  // Listón Superior
  const topGeo = new THREE.BoxGeometry(width, thickness, 0.02);
  const topMesh = new THREE.Mesh(topGeo, mat);
  topMesh.position.set(0, halfH - thickness / 2, 0);

  // Listón Inferior
  const botGeo = new THREE.BoxGeometry(width, thickness, 0.02);
  const botMesh = new THREE.Mesh(botGeo, mat);
  botMesh.position.set(0, -halfH + thickness / 2, 0);

  // Listón Izquierdo
  const leftGeo = new THREE.BoxGeometry(thickness, height - (thickness * 2), 0.02);
  const leftMesh = new THREE.Mesh(leftGeo, mat);
  leftMesh.position.set(-halfW + thickness / 2, 0, 0);

  // Listón Derecho
  const rightGeo = new THREE.BoxGeometry(thickness, height - (thickness * 2), 0.02);
  const rightMesh = new THREE.Mesh(rightGeo, mat);
  rightMesh.position.set(halfW - thickness / 2, 0, 0);

  group.add(topMesh, botMesh, leftMesh, rightMesh);
  return group;
}

/**
 * Construye la sala técnica 3D con distribución ordenada, subracks secuenciales y leyenda
 */
function buildDataCenterRoom(devices) {
  rackMeshes.forEach(m => scene.remove(m));
  rackMeshes = [];

  // Distribución de filas: Delante (BAJA), Centro (ESCALERA 1 + PRIMERA), Fondo (ESCALERA 2 + BUHARDILLA)
  const rowsConfig = [
    {
      z: 5.0, // Fila Delantera
      racksDef: [
        { name: 'BAJA', rackIndexInPlant: 0, totalPlantRacks: 3 },
        { name: 'BAJA', rackIndexInPlant: 1, totalPlantRacks: 3 },
        { name: 'BAJA', rackIndexInPlant: 2, totalPlantRacks: 3 }
      ]
    },
    {
      z: 0.0, // Fila Intermedia
      racksDef: [
        { name: 'ESCALERA 1', rackIndexInPlant: 0, totalPlantRacks: 1 },
        { name: 'PRIMERA', rackIndexInPlant: 0, totalPlantRacks: 3 },
        { name: 'PRIMERA', rackIndexInPlant: 1, totalPlantRacks: 3 },
        { name: 'PRIMERA', rackIndexInPlant: 2, totalPlantRacks: 3 }
      ]
    },
    {
      z: -5.0, // Fila del Fondo
      racksDef: [
        { name: 'ESCALERA 2', rackIndexInPlant: 0, totalPlantRacks: 1 },
        { name: 'BUHARDILLA', rackIndexInPlant: 0, totalPlantRacks: 3 },
        { name: 'BUHARDILLA', rackIndexInPlant: 1, totalPlantRacks: 3 },
        { name: 'BUHARDILLA', rackIndexInPlant: 2, totalPlantRacks: 3 }
      ]
    }
  ];

  const groupedByPlant = devices.reduce((acc, d) => {
    let planta = (d.planta || 'BAJA').toUpperCase();
    if (!acc[planta]) acc[planta] = [];
    acc[planta].push(d);
    return acc;
  }, {});

  // Recopilar estancias únicas presentes y armar el mapa con colores fijos
  const activeEstancias = [...new Set(devices.map(d => (d.estancia || 'GENERAL').trim()))].sort((a, b) => a.localeCompare(b));
  const estanciaColorMap = {};
  
  activeEstancias.forEach(est => {
    const roomObj = getRoomColor(est);
    estanciaColorMap[est.toUpperCase()] = roomObj.hex;
  });

  updateLegendUI(estanciaColorMap);

  rowsConfig.forEach((row) => {
    const zPos = row.z;
    const numRacksInRow = row.racksDef.length;

    row.racksDef.forEach((rackInfo, r) => {
      let rackCenterX = 0;
      if (numRacksInRow === 3) {
        rackCenterX = (r - 1) * 3.8;
      } else {
        rackCenterX = (r - 1.5) * 3.8;
      }

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

      // Puerta trasera de rejilla metálica
      const backDoorGeo = new THREE.PlaneGeometry(3.38, 4.38);
      const backDoorMat = new THREE.MeshBasicMaterial({
        map: rackMeshTexture,
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide
      });
      const backDoor = new THREE.Mesh(backDoorGeo, backDoorMat);
      backDoor.position.set(rackCenterX, 0, zPos - 0.61);
      backDoor.rotation.y = Math.PI;
      scene.add(backDoor);

      // Etiqueta superior del rack (Texto limpio flotante sin recuadros)
      const headerGeo = new THREE.PlaneGeometry(3.0, 1.0);
      const headerMat = new THREE.MeshBasicMaterial({
        map: createPlantHeaderTexture(rackInfo.name),
        transparent: true,
        side: THREE.DoubleSide
      });
      const headerMesh = new THREE.Mesh(headerGeo, headerMat);
      headerMesh.rotation.x = -Math.PI / 2;
      headerMesh.position.set(rackCenterX, 2.21, zPos);
      scene.add(headerMesh);

      const plantDevices = groupedByPlant[rackInfo.name] || [];

      const groupedByEstancia = plantDevices.reduce((acc, d) => {
        const estRaw = (d.estancia || 'GENERAL').trim();
        const estKey = estRaw.toUpperCase();
        if (!acc[estKey]) acc[estKey] = [];
        acc[estKey].push(d);
        return acc;
      }, {});

      const estanciasKeys = Object.keys(groupedByEstancia);
      const totalRacksForPlant = rackInfo.totalPlantRacks;
      const rackEstancias = estanciasKeys.filter((_, idx) => idx % totalRacksForPlant === rackInfo.rackIndexInPlant);

      // CÁLCULO SECUENCIAL PERFECTO:
      // Controlamos la posición vertical Y acumulada empezando desde el tope superior usable del rack (Y = 1.68)
      let currentYTop = 1.68;
      const rowStepY = 0.38;     // Distancia entre filas de blades
      const subrackPadding = 0.08; // Margen superior e inferior interno de cada marco
      const gapBetweenSubracks = 0.08; // Espacio libre entre subracks distintos

      rackEstancias.forEach(estanciaName => {
        const estanciaDevices = groupedByEstancia[estanciaName] || [];
        if (estanciaDevices.length === 0) return;

        const numDevices = estanciaDevices.length;
        const numRows = Math.ceil(numDevices / 2); // Número real de filas requeridas
        const contentHeight = numRows * rowStepY;
        const totalSubrackHeight = contentHeight + subrackPadding;

        // El centro del marco del subrack actual
        const subrackCenterY = currentYTop - (totalSubrackHeight / 2);

        // Color exacto obtenido del catálogo oficial de estancias
        const roomColorObj = getRoomColor(estanciaName);
        const colorValue = new THREE.Color(roomColorObj.value);

        // Crear marco 3D perimetral con grosor bien definido (0.04u)
        const subrackWidth = 3.24;
        const frameMesh = createSubrackFrameMesh(subrackWidth, totalSubrackHeight, 0.04, colorValue);
        frameMesh.position.set(rackCenterX, subrackCenterY, zPos + 0.61);
        scene.add(frameMesh);
        // NO se añade a rackMeshes para no bloquear clics del raycaster

        // Posicionar los dispositivos dentro del subrack actual
        const firstRowY = currentYTop - (subrackPadding / 2) - (rowStepY / 2);

        estanciaDevices.forEach((device, dIdx) => {
          const col = dIdx % 2; 
          const rowIdx = Math.floor(dIdx / 2);

          const xPos = rackCenterX + (col === 0 ? -0.78 : 0.78);
          const yPos = firstRowY - (rowIdx * rowStepY);

          const bladeGeo = new THREE.BoxGeometry(1.4, 0.27, 0.08);
          const bladeMat = new THREE.MeshStandardMaterial({ 
            map: createBladeTexture(device),
            emissive: 0xffffff,
            emissiveMap: createBladeTexture(device),
            emissiveIntensity: 0.25,
            roughness: 0.2
          });

          const bladeMesh = new THREE.Mesh(bladeGeo, bladeMat);
          bladeMesh.position.set(xPos, yPos, zPos + 0.63);
          
          bladeMesh.userData = device;
          scene.add(bladeMesh);
          rackMeshes.push(bladeMesh);
        });

        // Actualizar la cota Y superior para el siguiente subrack
        currentYTop = currentYTop - totalSubrackHeight - gapBetweenSubracks;
      });
    });
  });
}

/**
 * Crea o actualiza la caja de leyenda flotante en la esquina superior derecha
 */
function updateLegendUI(estanciaColorMap) {
  let legendEl = document.getElementById('room-legend-box');
  if (!legendEl) {
    legendEl = document.createElement('div');
    legendEl.id = 'room-legend-box';
    legendEl.className = 'absolute top-20 right-6 z-30 bg-slate-900/90 backdrop-blur-md p-3.5 rounded-xl border border-slate-700/80 shadow-2xl text-xs font-mono text-slate-200 max-w-xs';
    document.body.appendChild(legendEl);
  }

  let html = `<p class="font-bold text-blue-400 mb-2.5 pb-1.5 border-b border-slate-800 flex items-center gap-2"><i class="fa-solid fa-layer-group"></i> Leyenda de Estancias</p>`;
  html += `<div class="space-y-1.5 max-h-60 overflow-y-auto pr-1">`;

  for (const [estancia, hexColor] of Object.entries(estanciaColorMap)) {
    html += `
      <div class="flex items-center justify-between gap-3">
        <span class="text-slate-300 truncate">${estancia}</span>
        <span class="w-4 h-4 rounded-md shadow-sm shrink-0 border border-white/20" style="background-color: ${hexColor};"></span>
      </div>
    `;
  }

  html += `</div>`;
  legendEl.innerHTML = html;
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
