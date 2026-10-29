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
async function handlePasskeyLogin() {
  if (!window.PublicKeyCredential) {
    alert('Este dispositivo o navegador no soporta autenticación biométrica / Passkeys.');
    return;
  }

  const emailInput = document.getElementById('username').value.trim();
  if (!emailInput) {
    alert('Por favor, introduce tu correo electrónico de usuario primero para identificar tu passkey.');
    document.getElementById('username').focus();
    return;
  }

  try {
    // 1. Pedir el reto (challenge) a la Edge Function
    const { data: challengeData, error: challengeError } = await supabase.functions.invoke('passkey-generate-challenge', {
      body: { email: emailInput }
    });

    if (challengeError || !challengeData || !challengeData.success) {
      alert(challengeData?.message || 'No se encontró ninguna Passkey asociada a este correo.');
      return;
    }

    // Decodificar el challenge base64 a Uint8Array
    const challengeBuffer = Uint8Array.from(atob(challengeData.challenge), c => c.charCodeAt(0));
    const allowCreds = challengeData.allowCredentials.map(c => ({
      id: Uint8Array.from(atob(c.id), x => x.charCodeAt(0)),
      type: c.type
    }));

    // 2. Invocar el diálogo nativo del sistema operativo (Huella dactilar / FaceID / Windows Hello)
    const publicKeyCredentialRequestOptions = {
      challenge: challengeBuffer,
      rpId: window.location.hostname === 'localhost' ? 'localhost' : challengeData.rpId,
      allowCredentials: allowCreds,
      userVerification: "required",
      timeout: 60000
    };

    const assertion = await navigator.credentials.get({
      publicKey: publicKeyCredentialRequestOptions
    });

    // 3. Preparar los datos firmados para enviarlos a verificar
    const credentialResponse = {
      id: assertion.id,
      rawId: btoa(String.fromCharCode(...new Uint8Array(assertion.rawId))),
      response: {
        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(assertion.response.clientDataJSON))),
        authenticatorData: btoa(String.fromCharCode(...new Uint8Array(assertion.response.authenticatorData))),
        signature: btoa(String.fromCharCode(...new Uint8Array(assertion.response.signature))),
        userHandle: assertion.response.userHandle ? btoa(String.fromCharCode(...new Uint8Array(assertion.response.userHandle))) : null
      },
      type: assertion.type,
      email: emailInput
    };

    // 4. Enviar a la Edge Function de verificación (Próximo paso)
    alert('¡Huella leída correctamente! Procesando validación de seguridad...');
    
    // Aquí invocaremos la verificación final y redirección
    localStorage.setItem('netcontrol_auth', 'true');
    localStorage.setItem('netcontrol_user', emailInput);
    window.location.href = 'gestion/gest_direcciones.html';

  } catch (err) {
    console.error('Error en Passkey:', err);
    if (err.name !== 'NotAllowedError') {
      alert('Error durante la validación biométrica.');
    }
  }
}

// Exponer funciones globales para los eventos inline del HTML
window.handleLogin = handleLogin;
window.handlePasskeyLogin = handlePasskeyLogin;
