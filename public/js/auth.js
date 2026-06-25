let storedOtp = '';
let regData = { phone: '', name: '', password: '' };

function switchStep(stepId) {
  document.querySelectorAll('.auth-card').forEach(c => c.classList.add('hidden'));
  document.getElementById(stepId).classList.remove('hidden');
}

async function sendOTP() {
  const phone = document.getElementById('phone').value.trim();
  const displayName = document.getElementById('displayName').value.trim();
  
  if (!phone || !displayName) {
    alert('Please fill in all fields');
    return;
  }
  
  regData.phone = phone;
  regData.name = displayName;
  
  try {
    const res = await fetch('/api/auth/verify-phone', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone })
    });
    
    const data = await res.json();
    if (data.success) {
      storedOtp = data.otp;
      document.getElementById('otp-code').textContent = data.otp;
      document.getElementById('otp-display').style.display = 'block';
      switchStep('step2');
    } else {
      alert(data.error || 'Failed to send OTP');
    }
  } catch (err) {
    alert('Network error. Try again.');
  }
}

function verifyOTP() {
  const entered = document.getElementById('otp').value.trim();
  if (entered !== storedOtp) {
    alert('Invalid verification code');
    return;
  }
  switchStep('step3');
}

function backToStep1() {
  switchStep('step1');
  storedOtp = '';
}

function backToStep2() {
  switchStep('step2');
}

async function completeRegister() {
  const password = document.getElementById('password').value;
  const confirm = document.getElementById('confirmPassword').value;
  
  if (!password || password.length < 4) {
    alert('Password must be at least 4 characters');
    return;
  }
  if (password !== confirm) {
    alert('Passwords do not match');
    return;
  }
  
  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone_number: regData.phone,
        display_name: regData.name,
        password: password,
        otp_code: storedOtp
      })
    });
    
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.href = '/chat';
    } else {
      alert(data.error || 'Registration failed');
    }
  } catch (err) {
    alert('Network error');
  }
}

async function login() {
  const phone = document.getElementById('phone').value.trim();
  const password = document.getElementById('password').value;
  
  if (!phone || !password) {
    alert('Please enter phone number and password');
    return;
  }
  
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone_number: phone, password })
    });
    
    const data = await res.json();
    if (data.success) {
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      if (data.user.is_admin) {
        window.location.href = '/admin';
      } else {
        window.location.href = '/chat';
      }
    } else {
      alert(data.error || 'Login failed');
    }
  } catch (err) {
    alert('Network error');
  }
}

function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/login';
}
