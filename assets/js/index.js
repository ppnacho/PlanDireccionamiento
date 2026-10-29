/**
 * NetControl - Lógica de Autenticación de Portada
 */
import { supabase } from './supabaseClient.js';

document.addEventListener('DOMContentLoaded', () => {
  checkMobileBiometrics();
});

/**
 * Detecta si el acceso proviene de un dispositivo móvil para mostrar la opción de huella/Passkey
 */
function checkMobileBiometrics() {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
                   || (window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0));

  const bioSection = document.getElementById('biometric-section');
  
  if (isMobile && bioSection) {
    bioSection.classList.remove('hidden');
  }
}

async function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  // Aquí prepararemos la llamada real a Supabase en cuanto definamos el backend
  alert(`Acceso solicitado para: ${user}.`);
}

async function handlePasskeyLogin() {
  if (!window.PublicKeyCredential) {
    alert('Este dispositivo no soporta autenticación biométrica / Passkeys.');
    return;
  }
  try {
    alert('Iniciando protocolo WebAuthn (Passkey / Huella dactilar)...');
  } catch (err) {
    console.error(err);
    alert('Error en la autenticación biométrica.');
  }
}
