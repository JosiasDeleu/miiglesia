const handleLogin = async () => {
  const submitButton = document.getElementById('accederButton');
  const username = document.getElementById('username').value;
  const password = document.getElementById('password').value;

  if (!username || !password) {
    alert('Username and password are required.');
    return;
  }

  try {
    submitButton.disabled = true;

    const response = await fetch('/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    const result = await response.json();
    if (response.ok) {
      window.location.href = '/chat';
    } else {
      alert(result.message);
    }
  } catch {
    alert('Error al procesar la solicitud');
  } finally {
    submitButton.disabled = false;
  }
};

const resetPassword = async () => {
  const submitButton = document.getElementById('resetButton');
  const originalText = submitButton.innerHTML;
  const email = document.getElementById('resetEmailUserField').value;

  if (!email) {
    alert('Por favor ingrese su correo electrónico');
    return;
  }

  try {
    submitButton.disabled = true;
    submitButton.innerHTML = `${originalText} <span class="spinner"></span>`;

    const response = await fetch('/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const result = await response.json();
    alert(result.message);
    
    if (response.ok) {
      toggleForms('loginForm');
    }
  } catch {
    alert('Error al procesar la solicitud');
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = originalText;
  }
};

const toggleForms = (showFormId) => {
  document.getElementById('loginForm').style.display = showFormId === 'loginForm' ? 'block' : 'none';
  document.getElementById('forgotPasswordForm').style.display = showFormId === 'forgotPasswordForm' ? 'block' : 'none';
};

document.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    document.getElementById('forgotPasswordForm').style.display === 'block' ? resetPassword() : handleLogin();
  }
});

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('accederButton').addEventListener('click', handleLogin);
  document.getElementById('resetButton').addEventListener('click', resetPassword);
  document.getElementById('forgotPasswordLink').addEventListener('click', (e) => {
    e.preventDefault();
    toggleForms('forgotPasswordForm');
  });
  document.getElementById('backToLoginLink').addEventListener('click', (e) => {
    e.preventDefault();
    toggleForms('loginForm');
  });
});