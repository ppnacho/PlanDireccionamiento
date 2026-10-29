/**
 * NetControl - Lógica del Panel de Gestión de Direcciones IP
 */
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  verifySession();
  loadUserInfo();
});

/**
 * Verifica si el usuario cuenta con el indicador de sesión local autorizado
 */
function verifySession() {
  const isAuth = localStorage.getItem('netcontrol_auth');
  if (!isAuth || !isAuth === 'true') {
    window.location.href = '../index.html';
  }
}

/**
 * Carga el correo del usuario actual en el header si está disponible
 */
function loadUserInfo() {
  const userEmail = localStorage.getItem('netcontrol_user');
  if (userEmail) {
    const emailElements = document.querySelectorAll('.user-email-text');
    emailElements.forEach(el => el.textContent = userEmail);
  }
}

/**
 * Cierra la sesión activa y redirige al index
 */
window.handleLogout = function() {
  localStorage.removeItem('netcontrol_auth');
  localStorage.removeItem('netcontrol_user');
  window.location.href = '../index.html';
};

/**
 * Función para abrir el modal o formulario de alta de dispositivos
 */
window.openModalAlta = function() {
  alert('Abriendo formulario de Alta de Dispositivo...');
};
