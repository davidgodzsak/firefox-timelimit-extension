// Error handler to catch any loading issues
window.addEventListener('error', function(e) {
    console.error('Script error:', e.error, e.filename, e.lineno);
    
    // Show a basic error message if the main script fails
    const container = document.querySelector('.container');
    if (container && !document.querySelector('.error-fallback')) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-fallback';
        errorDiv.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            text-align: center;
            z-index: 10000;
        `;
        
        const refreshButton = document.createElement('button');
        refreshButton.textContent = 'Refresh Page';
        refreshButton.style.cssText = `
            background: #4f46e5;
            color: white;
            border: none;
            padding: 0.5rem 1rem;
            border-radius: 4px;
            cursor: pointer;
        `;
        refreshButton.addEventListener('click', () => location.reload());
        
        errorDiv.innerHTML = `
            <h2 style="color: #dc2626; margin: 0 0 1rem 0;">Settings Failed to Load</h2>
            <p style="margin: 0 0 1rem 0;">There was an error loading the settings page.</p>
            <p style="margin: 0 0 1rem 0; font-family: monospace; font-size: 0.875rem; color: #666;">
                ${e.error ? e.error.message : 'Unknown error'}
            </p>
        `;
        
        errorDiv.appendChild(refreshButton);
        document.body.appendChild(errorDiv);
    }
});

// Check if browser API is available immediately
if (typeof browser === 'undefined' && typeof chrome === 'undefined') {
    console.error('No WebExtension API available');
} else {
    console.log('WebExtension API available:', typeof browser !== 'undefined' ? 'browser' : 'chrome');
} 