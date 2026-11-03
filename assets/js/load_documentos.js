/**
 * NetControl - Lógica de Gestión Documental por Dispositivo (100% vía Edge Function)
 */
import { supabase } from './supabaseClient.js';

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

  await loadBucketFiles();

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
 * Lista los archivos invocando a la Edge Function
 */
window.loadBucketFiles = async function() {
  const explorerEl = document.getElementById('file-explorer');
  explorerEl.innerHTML = `<div class="text-center py-6 text-slate-500 italic"><i class="fa-solid fa-spinner fa-spin mr-2"></i> Consultando repositorio seguro...</div>`;

  try {
    const { data, error } = await supabase.functions.invoke(`gestion-bucket?id=${deviceId}&action=list`, {
      method: 'GET'
    });

    if (error) throw new Error(error.message || 'Error de comunicación.');
    if (data && data.success === false) throw new Error(data.message);

    document.getElementById('subtitle-device').textContent = `Host: @${data.hostname || 'Desconocido'}`;
    document.getElementById('badge-bucket').textContent = `bucket: ${data.bucketName}`;

    const files = data.files || [];

    if (files.length === 0) {
      explorerEl.innerHTML = `<div class="text-center py-8 text-slate-500 italic bg-slate-950/50 rounded-xl border border-slate-800">No hay documentos en este repositorio.</div>`;
      return;
    }

    let html = `<div class="divide-y divide-slate-800/80 bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">`;

    files.forEach(item => {
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
    explorerEl.innerHTML = `<div class="text-center py-6 text-red-400">Error: ${err.message}</div>`;
  }
};

/**
 * Sube un archivo convirtiéndolo a Base64 y enviándolo a la Edge Function
 */
async function handleFileUpload(e) {
  e.preventDefault();
  const btn = document.getElementById('btn-upload');
  const fileInput = document.getElementById('file-input');
  const folderInput = document.getElementById('folder-path');

  if (fileInput.files.length === 0) return;

  const file = fileInput.files[0];
  const folder = folderInput.value.trim();

  btn.disabled = true;
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Subiendo...`;

  try {
    // Convertir archivo a Base64 en el cliente
    const base64Data = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });

    const payload = {
      fileName: file.name,
      folder: folder,
      fileBase64: base64Data,
      contentType: file.type
    };

    const { data, error } = await supabase.functions.invoke(`gestion-bucket?id=${deviceId}&action=upload`, {
      body: payload
    });

    if (error) throw new Error(error.message || 'Error de red.');
    if (data && data.success === false) throw new Error(data.message);

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
 * Pide una URL firmada a la Edge Function para descargar el archivo de forma segura
 */
window.downloadFile = async function(path) {
  try {
    const { data, error } = await supabase.functions.invoke(`gestion-bucket?id=${deviceId}&action=download&path=${encodeURIComponent(path)}`, {
      method: 'GET'
    });

    if (error) throw error;
    if (data && data.success === false) throw new Error(data.message);

    const link = document.createElement('a');
    link.href = data.signedUrl;
    link.download = path.split('/').pop();
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    console.error('Error al descargar:', err);
    alert(`No se pudo descargar: ${err.message}`);
  }
};

/**
 * Elimina un archivo invocando a la Edge Function
 */
window.deleteFile = async function(path) {
  if (!confirm(`¿Estás seguro de que deseas eliminar "${path}"?`)) return;

  try {
    const { error } = await supabase.functions.invoke(`gestion-bucket?id=${deviceId}&action=delete&path=${encodeURIComponent(path)}`, {
      method: 'DELETE'
    });

    if (error) throw error;

    await loadBucketFiles();

  } catch (err) {
    console.error('Error al eliminar:', err);
    alert(`Error al eliminar: ${err.message}`);
  }
};
