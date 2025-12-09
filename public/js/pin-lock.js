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

    // Check if user has permission for current page
    function checkPagePermission() {
        const userStr = sessionStorage.getItem('swingcity_user');
        if (!userStr) {
            // Default PIN user has full access
            return true;
        }
        
        try {
            const user = JSON.parse(userStr);
            const isManagement = user.management === true;
            
            // Management users have full access
            if (isManagement) {
                return true;
            }
            
            // Non-management users can only access: dashboard, teams, leaderboard, highscores, podium, training
            const path = window.location.pathname;
            const allowedPages = ['/', '/dashboard', '/teams', '/leaderboard', '/highscores', '/podium', '/training'];
            const restrictedPages = ['/settings', '/download'];
            
            // Check if current path is restricted
            if (restrictedPages.some(page => path.startsWith(page))) {
                return false;
            }
            
            // Allow access to allowed pages or unknown pages (default allow)
            return true;
        } catch (error) {
            console.error('Error checking permissions:', error);
            return true; // Default to allowing access on error
        }
    }

    // Show permission denied message
    function showPermissionDenied() {
        const overlay = document.getElementById('pinOverlay');
        const pinContainer = overlay?.querySelector('.pin-container');
        
        if (pinContainer) {
            pinContainer.innerHTML = `
                <img src="/images/swingcity-main-logo.png" alt="SwingCity" class="pin-logo">
                <h1 class="pin-title" style="color: #ef4444;">Access Denied</h1>
                <p class="pin-subtitle" style="color: #9ca3af; margin-bottom: 1.5rem;">
                    You don't have permission to access this page.
                </p>
                <a href="/" style="display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.875rem 1.5rem; background: var(--accent-purple, #a855f7); color: white; border-radius: 10px; text-decoration: none; font-weight: 600; transition: all 0.2s ease;">
                    <iconify-icon icon="ph:arrow-left-bold"></iconify-icon>
                    Go to Dashboard
                </a>
            `;
            overlay.classList.remove('hidden');
        }
    }

    // Unlock the page
    function unlockPage() {
        // Check permissions first
        if (!checkPagePermission()) {
            showPermissionDenied();
            return;
        }
        
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
    function showSuccess(user) {
        const digits = document.querySelectorAll('.pin-digit');
        digits.forEach(d => d.classList.add('success'));
        
        setTimeout(() => {
            sessionStorage.setItem(SESSION_KEY, 'true');
            // Store user info and permissions
            if (user) {
                sessionStorage.setItem('swingcity_user', JSON.stringify(user));
            }
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
                showSuccess(data.user);
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

