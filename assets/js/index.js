/**
 * NetControl - Lógica de Autenticación de Portada mediante Edge Function
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

/**
 * Manejo del inicio de sesión llamando a la Edge Function 'acceso-users'
 */
async function handleLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById('username').value.trim();
  const passwordInput = document.getElementById('password').value.trim();

  try {
    // Invocación a la Supabase Edge Function
    const { data, error } = await supabase.functions.invoke('acceso-users', {
      body: { email: emailInput, password: passwordInput }
    });

    if (error || !data || !data.success) {
      alert(data?.message || 'Acceso denegado: Credenciales incorrectas.');
      return;
    }

    // Si la Edge Function valida el acceso correctamente
    localStorage.setItem('netcontrol_auth', 'true');
    localStorage.setItem('netcontrol_user', data.email);

    // Redirigir a la carpeta gestion/gest_direcciones.html
    window.location.href = 'gestion/gest_direcciones.html';

  } catch (err) {
    console.error('Error al invocar la Edge Function:', err);
    alert('Ocurrió un error al conectar con el servidor de autenticación.');
  }
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

// Exponer funciones globales para los eventos inline del HTML
window.handleLogin = handleLogin;
window.handlePasskeyLogin = handlePasskeyLogin;
