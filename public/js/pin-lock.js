// ==================== PIN LOCK SYSTEM ====================
(function() {
    const SESSION_KEY = 'swingcity_authenticated';
    
    // Check if already authenticated
    function checkAuth() {
        if (sessionStorage.getItem(SESSION_KEY) === 'true') {
            unlockPage();
            return true;
        }
        return false;
    }

    // Unlock the page
    function unlockPage() {
        const overlay = document.getElementById('pinOverlay');
        const content = document.getElementById('pageContent');
        
        if (overlay) {
            overlay.classList.add('hidden');
        }
        if (content) {
            content.style.display = '';
        }
        
        // Trigger custom event for pages that need to do something after unlock
        window.dispatchEvent(new CustomEvent('pinUnlocked'));
    }

    // Get current PIN value
    function getCurrentPin() {
        const digits = document.querySelectorAll('.pin-digit');
        return Array.from(digits).map(d => d.value).join('');
    }

    // Clear PIN inputs
    function clearPin() {
        const digits = document.querySelectorAll('.pin-digit');
        digits.forEach(d => {
            d.value = '';
            d.classList.remove('error', 'success');
        });
        // Don't focus to prevent keyboard popup
    }

    // Show error state
    function showError() {
        const pinError = document.getElementById('pinError');
        const digits = document.querySelectorAll('.pin-digit');
        
        if (pinError) pinError.classList.add('visible');
        digits.forEach(d => d.classList.add('error'));
        
        setTimeout(() => {
            if (pinError) pinError.classList.remove('visible');
            clearPin();
        }, 1500);
    }

    // Show success state
    function showSuccess() {
        const digits = document.querySelectorAll('.pin-digit');
        digits.forEach(d => d.classList.add('success'));
        
        setTimeout(() => {
            sessionStorage.setItem(SESSION_KEY, 'true');
            unlockPage();
        }, 400);
    }

    // Verify PIN with backend
    async function verifyPin(pin) {
        try {
            const response = await fetch('/api/verify-pin', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pin })
            });
            const data = await response.json();
            
            if (data.success) {
                showSuccess();
            } else {
                showError();
            }
        } catch (error) {
            console.error('PIN verification error:', error);
            showError();
        }
    }

        // Handle PIN input
    function handlePinInput(index, value) {
        const digits = document.querySelectorAll('.pin-digit');
        
        if (!/^\d$/.test(value)) {
            digits[index].value = '';
            return;
        }

        digits[index].value = value;
        
        // Don't auto-focus next input to prevent keyboard popup
        
        // Check if all digits are filled
        const pin = getCurrentPin();
        if (pin.length === 4) {
            verifyPin(pin);
        }
    }

    // Handle backspace/delete
    function handleDelete(index) {
        const digits = document.querySelectorAll('.pin-digit');
        
        if (digits[index].value) {
            digits[index].value = '';
        } else if (index > 0) {
            digits[index - 1].value = '';
            // Don't focus to prevent keyboard popup
        }
    }

    // Initialize PIN lock
    function initPinLock() {
        // Check if already authenticated
        if (checkAuth()) {
            return;
        }

        const pinOverlay = document.getElementById('pinOverlay');
        const digits = document.querySelectorAll('.pin-digit');
        const pinKeys = document.querySelectorAll('.pin-key');

        if (!pinOverlay || digits.length === 0) {
            // No PIN lock on this page
            return;
        }

        // Prevent keyboard from appearing on mobile
        digits.forEach((digit, index) => {
            // Prevent focus events that trigger keyboard
            digit.addEventListener('focus', (e) => {
                e.preventDefault();
                digit.blur();
            });

            // Prevent touch events from focusing
            digit.addEventListener('touchstart', (e) => {
                e.preventDefault();
            });

            // Prevent click events from focusing
            digit.addEventListener('click', (e) => {
                e.preventDefault();
            });
        });

        // Keypad button listeners
        pinKeys.forEach(key => {
            key.addEventListener('click', () => {
                const value = key.dataset.value;
                
                if (value === 'delete') {
                    // Find last filled digit
                    for (let i = 3; i >= 0; i--) {
                        if (digits[i].value) {
                            handleDelete(i);
                            break;
                        }
                    }
                } else if (value) {
                    // Find first empty digit
                    for (let i = 0; i <= 3; i++) {
                        if (!digits[i].value) {
                            handlePinInput(i, value);
                            break;
                        }
                    }
                }
            });
        });

        // Physical keyboard support
        document.addEventListener('keydown', (e) => {
            if (pinOverlay.classList.contains('hidden')) return;
            
            if (/^\d$/.test(e.key)) {
                e.preventDefault();
                for (let i = 0; i <= 3; i++) {
                    if (!digits[i].value) {
                        handlePinInput(i, e.key);
                        break;
                    }
                }
            }
        });

        // Don't auto-focus to prevent keyboard popup on mobile
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPinLock);
    } else {
        initPinLock();
    }
})();

