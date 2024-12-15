import { getAuth, reauthenticateWithCredential, updatePassword, EmailAuthProvider } from "firebase/auth";
import { auth } from "./firebase";
import '../components/detail/changePassword.css';

export const changePassword = async () => {
  const createPasswordModal = () => {
    const modal = document.createElement('div');
    modal.className = 'password-change-modal';
    modal.innerHTML = `
      <div class="password-change-container">
        <h2>Change Password</h2>
        <div class="password-input-group">
          <label>Current Password</label>
          <div class="password-input-wrapper">
            <input type="password" id="currentPassword" placeholder="Enter current password" required />
            <button class="toggle-password" data-target="currentPassword">👁️</button>
          </div>
        </div>
        <div class="password-input-group">
          <label>New Password</label>
          <div class="password-input-wrapper">
            <input type="password" id="newPassword" placeholder="Enter new password" required />
            <button class="toggle-password" data-target="newPassword">👁️</button>
          </div>
          <div class="password-strength">
            <span>Password Strength: </span>
            <span id="passwordStrength">Weak</span>
          </div>
        </div>
        <div class="password-input-group">
          <label>Confirm New Password</label>
          <div class="password-input-wrapper">
            <input type="password" id="confirmPassword" placeholder="Confirm new password" required />
            <button class="toggle-password" data-target="confirmPassword">👁️</button>
          </div>
        </div>
        <div class="password-error" id="passwordError"></div>
        <div class="password-button-group">
          <button id="cancelButton">Cancel</button>
          <button id="changePasswordButton">Change Password</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  };

  const checkPasswordStrength = (password) => {
    const strength = {
      weak: /^.{1,7}$/,
      medium: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/,
      strong: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{12,}$/
    };

    if (strength.strong.test(password)) return 'Strong';
    if (strength.medium.test(password)) return 'Medium';
    return 'Weak';
  };

  return new Promise((resolve, reject) => {
    const modal = createPasswordModal();
    const currentPasswordInput = modal.querySelector('#currentPassword');
    const newPasswordInput = modal.querySelector('#newPassword');
    const confirmPasswordInput = modal.querySelector('#confirmPassword');
    const passwordStrengthSpan = modal.querySelector('#passwordStrength');
    const errorDiv = modal.querySelector('#passwordError');
    const changePasswordButton = modal.querySelector('#changePasswordButton');
    const cancelButton = modal.querySelector('#cancelButton');
    const togglePasswordButtons = modal.querySelectorAll('.toggle-password');

    togglePasswordButtons.forEach(button => {
      button.addEventListener('click', () => {
        const targetId = button.getAttribute('data-target');
        const input = modal.querySelector(`#${targetId}`);
        
        if (input.type === 'password') {
          input.type = 'text';
          button.textContent = '🙈';
        } else {
          input.type = 'password';
          button.textContent = '👁️';
        }
      });
    });

    newPasswordInput.addEventListener('input', () => {
      const strength = checkPasswordStrength(newPasswordInput.value);
      passwordStrengthSpan.textContent = strength;
      passwordStrengthSpan.style.color = 
        strength === 'Strong' ? 'green' : 
        strength === 'Medium' ? 'orange' : 'red';
    });

    const closeModal = () => {
      document.body.removeChild(modal);
    };

    cancelButton.addEventListener('click', () => {
      closeModal();
      reject(new Error('Password change cancelled'));
    });

    changePasswordButton.addEventListener('click', async () => {
      errorDiv.textContent = '';

      if (!currentPasswordInput.value || !newPasswordInput.value || !confirmPasswordInput.value) {
        errorDiv.textContent = 'All fields are required.';
        return;
      }

      if (checkPasswordStrength(newPasswordInput.value) === 'Weak') {
        errorDiv.textContent = 'Password is too weak. Use a stronger password.';
        return;
      }

      if (newPasswordInput.value !== confirmPasswordInput.value) {
        errorDiv.textContent = 'New passwords do not match.';
        return;
      }

      try {
        const user = auth.currentUser;
        if (!user) {
          throw new Error('No user is currently signed in.');
        }

        const credential = EmailAuthProvider.credential(
          user.email, 
          currentPasswordInput.value
        );

        await reauthenticateWithCredential(user, credential);

        await updatePassword(user, newPasswordInput.value);

        errorDiv.style.color = 'green';
        errorDiv.textContent = 'Password changed successfully!';

        setTimeout(closeModal, 2000);

        resolve();
      } catch (error) {
        console.error('Password change error:', error);
        
        let errorMessage = 'An error occurred while changing the password.';

        switch (error.code) {
          case 'auth/invalid-credential':
            errorMessage = 'Current password is incorrect. Please try again.';
            break;
          case 'auth/too-many-requests':
            errorMessage = 'Too many attempts. Please try again later.';
            break;
          case 'auth/weak-password':
            errorMessage = 'New password is too weak.';
            break;
          default:
            errorMessage = error.message || 'An unexpected error occurred.';
        }

        errorDiv.textContent = errorMessage;
        reject(error);
      }
    });
  });
};