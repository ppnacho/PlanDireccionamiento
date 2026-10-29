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

/**
 * Registra una nueva Passkey (Huella dactilar) para el usuario actual en este dispositivo
 */
window.handleRegisterPasskey = async function() {
  if (!window.PublicKeyCredential) {
    alert('Este dispositivo no soporta Passkeys.');
    return;
  }

  const userEmail = localStorage.getItem('netcontrol_user');
  if (!userEmail) {
    alert('No se reconoce el usuario activo.');
    return;
  }

  try {
    // 1. Pedir opciones de registro a la Edge Function
    const { data: optionsData, error: optError } = await supabase.functions.invoke('passkey-register-challenge', {
      body: { email: userEmail }
    });

    if (optError || !optionsData || !optionsData.success) {
      alert(optionsData?.message || 'Error al iniciar el registro de la passkey.');
      return;
    }

    // Decodificar el challenge
    const challengeBuffer = Uint8Array.from(atob(optionsData.challenge), c => c.charCodeAt(0));
    const userIdBuffer = Uint8Array.from(atob(optionsData.user.id), c => c.charCodeAt(0));

    const publicKeyCredentialCreationOptions = {
      challenge: challengeBuffer,
      rp: optionsData.rp,
      user: {
        id: userIdBuffer,
        name: optionsData.user.name,
        displayName: optionsData.user.displayName
      },
      pubKeyCredParams: optionsData.pubKeyCredParams,
      timeout: optionsData.timeout,
      attestation: optionsData.attestation,
      authenticatorSelection: optionsData.authenticatorSelection
    };

    // 2. Invocar el diálogo nativo del sistema para registrar la huella
    const credential = await navigator.credentials.create({
      publicKey: publicKeyCredentialCreationOptions
    });

    // 3. Preparar credencial para enviar al servidor
    const credentialResponse = {
      id: credential.id,
      rawId: btoa(String.fromCharCode(...new Uint8Array(credential.rawId))),
      response: {
        clientDataJSON: btoa(String.fromCharCode(...new Uint8Array(credential.response.clientDataJSON))),
        attestationObject: btoa(String.fromCharCode(...new Uint8Array(credential.response.attestationObject)))
      },
      type: credential.type
    };

    // 4. Enviar a la Edge Function de verificación y guardado
    const { data: verifyData, error: verifyError } = await supabase.functions.invoke('passkey-register-verify', {
      body: { email: userEmail, credential: credentialResponse }
    });

    if (verifyError || !verifyData || !verifyData.success) {
      alert(verifyData?.message || 'Error al guardar la passkey en el servidor.');
      return;
    }

    alert('¡Passkey / Huella registrada con éxito! A partir de ahora podrás iniciar sesión con ella.');

  } catch (err) {
    console.error('Error en registro Passkey:', err);
    if (err.name !== 'NotAllowedError') {
      alert('Hubo un problema al registrar la huella en el dispositivo.');
    }
  }
};
