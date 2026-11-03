/**
 * NetControl - Lógica de Gestión Documental por Dispositivo
 */
import { supabase } from './supabaseClient.js';

let currentBucketName = null;
let deviceId = null;

document.addEventListener('DOMContentLoaded', async () => {
  verifySession();
  loadUserInfo();

  const urlParams = new URLSearchParams(window.location.search);
  deviceId = urlParams.get('id');

  if (!deviceId) {
    alert('No se ha especificado ningún dispositivo.');
    window.location.href = 'representacion_3d.html';
    return;
  }

  await inicializarBucketYDocumentacion(deviceId);

  document.getElementById('form-upload').addEventListener('submit', handleFileUpload);
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
 * Invoca a la Edge Function para asegurar la creación del bucket y obtener su nombre exacto
 */
async function inicializarBucketYDocumentacion(id) {
  try {
    const { data, error } = await supabase.functions.invoke(`gestion-bucket?id=${id}`, {
      method: 'GET'
    });

    if (error) throw new Error(error.message || 'Error de comunicación con el servidor.');
    if (data && data.success === false) throw new Error(data.message || 'Error al preparar el almacenamiento.');

    currentBucketName = data.bucketName;
    document.getElementById('subtitle-device').textContent = `Host: @${data.hostname || 'Desconocido'}`;
    document.getElementById('badge-bucket').textContent = `bucket: ${currentBucketName}`;

    // Cargar los archivos existentes en el bucket
    await loadBucketFiles();

  } catch (err) {
    console.error('Error al inicializar bucket:', err);
    alert(`Error al inicializar almacenamiento: ${err.message}`);
    window.location.href = 'representacion_3d.html';
  }
}

/**
 * Lista los archivos del bucket y los organiza visualmente
 */
window.loadBucketFiles = async function() {
  const explorerEl = document.getElementById('file-explorer');
  explorerEl.innerHTML = `<div class="text-center py-6 text-slate-500 italic"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Analizando repositorio...</div>`;

  try {
    // Listar objetos en la raíz del bucket (pasando '' para listar todo recursivamente o nivel superior)
    const { data, error } = await supabase.storage
      .from(currentBucketName)
      .list('', {
        limit: 200,
        sortBy: { column: 'name', order: 'asc' }
      });

    if (error) throw error;

    if (!data || data.length === 0) {
      explorerEl.innerHTML = `<div class="text-center py-8 text-slate-500 italic bg-slate-950/50 rounded-xl border border-slate-800">No hay documentos ni carpetas en este repositorio todavía.</div>`;
      return;
    }

    let html = `<div class="divide-y divide-slate-800/80 bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">`;

    data.forEach(item => {
      // Si el item no tiene id, Supabase lo interpreta a veces como carpeta virtual o elemento especial
      const isFolder = item.id === null || !item.metadata;
      const itemName = item.name;

      if (isFolder) {
        html += `
          <div class="p-3 flex items-center justify-between hover:bg-slate-900/40 transition">
            <span class="text-indigo-400 font-bold flex items-center gap-2">
              <i class="fa-solid fa-folder text-indigo-500"></i> ${itemName}/
            </span>
            <span class="text-[10px] text-slate-500 uppercase">Carpeta</span>
          </div>
        `;
      } else {
        const fileSize = item.metadata?.size ? (item.metadata.size / 1024).toFixed(1) + ' KB' : '';
        html += `
          <div class="p-3 flex items-center justify-between hover:bg-slate-900/40 transition">
            <div class="flex items-center gap-2.5 overflow-hidden">
              <i class="fa-solid fa-file-lines text-slate-400"></i>
              <span class="text-slate-200 truncate">${itemName}</span>
              ${fileSize ? `<span class="text-[10px] text-slate-500">(${fileSize})</span>` : ''}
            </div>
            <div class="flex items-center gap-2">
              <button onclick="downloadFile('${itemName}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-indigo-300 transition text-[11px] border border-slate-700" title="Descargar">
                <i class="fa-solid fa-download"></i>
              </button>
              <button onclick="deleteFile('${itemName}')" class="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-red-900/40 text-red-400 transition text-[11px] border border-slate-700" title="Eliminar">
                <i class="fa-solid fa-trash"></i>
              </button>
            </div>
          </div>
        `;
      }
    });

    html += `</div>`;
    explorerEl.innerHTML = html;

  } catch (err) {
    console.error('Error al listar archivos:', err);
    explorerEl.innerHTML = `<div class="text-center py-6 text-red-400">Error al cargar el repositorio: ${err.message}</div>`;
  }
};

/**
 * Maneja la subida de un archivo al bucket (con soporte para subcarpetas virtuales)
 */
async function handleFileUpload(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-upload');
  const fileInput = document.getElementById('file-input');
  const folderInput = document.getElementById('folder-path');

  if (fileInput.files.length === 0) return;

  const file = fileInput.files[0];
  const folder = folderInput.value.trim().replace(/^\/+|\/+$/g, ''); // Limpiar barras iniciales/finales
  const filePath = folder ? `${folder}/${file.name}` : file.name;

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...`;

  try {
    const { data, error } = await supabase.storage
      .from(currentBucketName)
      .upload(filePath, file, {
        upsert: true // Sobrescribir si ya existe
      });

    if (error) throw error;

    alert('¡Archivo subido con éxito!');
    fileInput.value = '';
    folderInput.value = '';
    await loadBucketFiles();

  } catch (err) {
    console.error('Error al subir archivo:', err);
    alert(`Error al subir: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i class="fa-solid fa-upload"></i> Subir Archivo`;
  }
}

/**
 * Genera una URL firmada temporal y descarga el archivo
 */
window.downloadFile = async function(path) {
  try {
    const { data, error } = await supabase.storage
      .from(currentBucketName)
      .createSignedUrl(path, 60); // URL válida por 60 segundos

    if (error) throw error;

    // Abrir o descargar enlace firmado
    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = path.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    console.error('Error al descargar:', err);
    alert(`No se pudo descargar el archivo: ${err.message}`);
  }
};

/**
 * Elimina un archivo del bucket
 */
window.deleteFile = async function(path) {
  if (!confirm(`¿Estás seguro de que deseas eliminar el archivo "${path}"?`)) return;

  try {
    const { error } = await supabase.storage
      .from(currentBucketName)
      .remove([path]);

    if (error) throw error;

    await loadBucketFiles();

  } catch (err) {
    console.error('Error al eliminar:', err);
    alert(`Error al eliminar el archivo: ${err.message}`);
  }
};
