/**
 * NetControl - Lógica de Autenticación de Portada
 */

function handleLogin(e) {
  e.preventDefault();
  const user = document.getElementById('username').value;
  alert(`Acceso solicitado para: ${user}.`);
}

async function handlePasskeyLogin() {
  if (!window.PublicKeyCredential) {
    alert('Este navegador no soporta autenticación biométrica / Passkeys.');
    return;
  }
  try {
    alert('Iniciando protocolo WebAuthn (Passkey / Huella dactilar)...');
  } catch (err) {
    console.error(err);
    alert('Error en la autenticación biométrica.');
  }
}
