// SwingCity V2 Crazy Golf System - Main JavaScript

document.addEventListener('DOMContentLoaded', function() {
    console.log('� SwingCity V2 Crazy Golf System loaded successfully!');
    
    // Initialize tooltips
    var tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'));
    var tooltipList = tooltipTriggerList.map(function (tooltipTriggerEl) {
        return new bootstrap.Tooltip(tooltipTriggerEl);
    });

    // Initialize popovers
    var popoverTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="popover"]'));
    var popoverList = popoverTriggerList.map(function (popoverTriggerEl) {
        return new bootstrap.Popover(popoverTriggerEl);
    });

    // Smooth scrolling for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // API health check
    checkAPIHealth();
    
    // Check for system updates every 30 seconds
    setInterval(checkAPIHealth, 30000);
});

// Check API health
async function checkAPIHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        console.log('System Health:', data);
        
        // Update any global status indicators
        const statusElements = document.querySelectorAll('.system-status');
        statusElements.forEach(el => {
            if (data.status === 'healthy') {
                el.classList.remove('error');
                el.classList.add('healthy');
            } else {
                el.classList.remove('healthy');
                el.classList.add('error');
            }
        });
    } catch (error) {
        console.error('Health check failed:', error);
        
        // Update status to error
        const statusElements = document.querySelectorAll('.system-status');
        statusElements.forEach(el => {
            el.classList.remove('healthy');
            el.classList.add('error');
        });
    }
}

// Show alert messages
function showAlert(type, message, duration = 5000) {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    // Find a container or use body
    const container = document.querySelector('.container') || document.body;
    container.insertBefore(alertDiv, container.firstChild);
    
    // Auto-dismiss after duration
    if (duration > 0) {
        setTimeout(() => {
            alertDiv.remove();
        }, duration);
    }
}

// Format timestamp for display
function formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

// Format duration in milliseconds to human readable
function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
}

// Utility functions for the crazy golf system
const SwingCity = {
    // Format score with proper sign
    formatScore: function(score) {
        return score > 0 ? `+${score}` : `${score}`;
    },

    // Get score color class
    getScoreClass: function(score) {
        if (score > 0) return 'positive';
        if (score < 0) return 'negative';
        return 'neutral';
    },

    // Format RFID for display
    formatRFID: function(rfid) {
        return rfid.toString().replace(/(\d{4})(?=\d)/g, '$1-');
    },

    // Show loading spinner
    showLoading: function(element, text = 'Loading...') {
        if (element) {
            element.innerHTML = `<span class="spinner"></span> ${text}`;
            element.disabled = true;
        }
    },

    // Hide loading spinner
    hideLoading: function(element, originalContent) {
        if (element) {
            element.innerHTML = originalContent;
            element.disabled = false;
        }
    },

    // Play notification sound (placeholder)
    playSound: function(type) {
        console.log(`🔊 Playing sound: ${type}`);
        // Implement actual sound playing logic here
    },

    // Vibrate device if supported
    vibrate: function(pattern = [200]) {
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        }
    }
};

// Make SwingCity utilities globally available
window.SwingCity = SwingCity;
window.showAlert = showAlert;
window.formatTimestamp = formatTimestamp;
window.formatDuration = formatDuration;
