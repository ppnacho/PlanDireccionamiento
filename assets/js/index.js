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

/**
 * NetControl - Lógica de Autenticación Biométrica (Passkey / Huella)
 */
window.handlePasskeyLogin = async function() {
  if (!window.PublicKeyCredential) {
    alert('Este dispositivo no soporta Passkeys.');
    return;
  }

  try {
    // Intentar coger el email por si el usuario lo escribió, pero no es obligatorio
    const emailInput = document.getElementById('username')?.value?.trim() || '';

    // 1. Pedir el reto al servidor
    const { data: challengeData, error: challengeError } = await supabase.functions.invoke('passkey-generate-challenge', {
      body: { email: emailInput }
    });

    if (challengeError || !challengeData || !challengeData.success) {
      alert(challengeData?.message || 'Error al solicitar el reto biométrico.');
      return;
    }

    const challengeBuffer = Uint8Array.from(atob(challengeData.challenge), c => c.charCodeAt(0));
    
    const options = {
      challenge: challengeBuffer,
      rpId: challengeData.rpId,
      userVerification: "required",
      timeout: 60000
    };

    // Si hay credenciales específicas filtradas, se añaden
    if (challengeData.allowCredentials && challengeData.allowCredentials.length > 0) {
      options.allowCredentials = challengeData.allowCredentials.map(c => ({
        id: Uint8Array.from(atob(c.id), x => x.charCodeAt(0)),
        type: c.type
      }));
    }

    // 2. Abrir el lector de huellas del móvil (aparecerá tu cuenta guardada automáticamente)
    const assertion = await navigator.credentials.get({
      publicKey: options
    });

    const credentialResponse = {
      id: assertion.id,
      rawId: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))),
      response: {
        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON))),
        authenticatorData: btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData))),
        signature: btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature))),
        userHandle: assertion.response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(assertion.response.userHandle))) : null
      },
      type: assertion.type
    };

    // 3. Enviar a verificar a la Edge Function de login
    const { data: verifyData, error: verifyError } = await supabase.functions.invoke('passkey-verify', {
      body: { credential: credentialResponse }
    });

    if (verifyError || !verifyData || !verifyData.success) {
      alert(verifyData?.message || 'No se pudo validar la huella.');
      return;
    }

    // 4. Guardar sesión y redirigir
    localStorage.setItem('netcontrol_auth', 'true');
    localStorage.setItem('netcontrol_user', verifyData.email);
    localStorage.setItem('netcontrol_rol', verifyData.rol);
    
    window.location.href = 'gestion/gest_direcciones.html';

  } catch (err) {
    console.error('Error en login Passkey:', err);
    if (err.name !== 'NotAllowedError') {
      alert('Error durante el acceso biométrico.');
    }
  }
}

// Exponer funciones globales para los eventos inline del HTML
window.handleLogin = handleLogin;
window.handlePasskeyLogin = handlePasskeyLogin;
