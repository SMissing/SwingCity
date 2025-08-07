/**
 * Automatic Image Cropping Utility
 * Dynamically detects and crops PNG images to their actual content
 */

class ImageAutoCropper {
    constructor() {
        this.processedImages = new Set();
        this.init();
    }

    init() {
        // Process images when they load
        this.setupImageObserver();
        console.log('🖼️ Image Auto-Cropper initialized');
    }

    setupImageObserver() {
        // Use Intersection Observer to process images when they're visible
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    if (img.tagName === 'IMG' && !this.processedImages.has(img.src)) {
                        this.processImage(img);
                        this.processedImages.add(img.src);
                    }
                }
            });
        });

        // Observe all logo images (both old and new classes)
        document.querySelectorAll('.hole-logo-image, .hole-logo-image-fullsize').forEach(img => {
            if (img.complete) {
                this.processImage(img);
                this.processedImages.add(img.src);
            } else {
                img.addEventListener('load', () => {
                    this.processImage(img);
                    this.processedImages.add(img.src);
                });
            }
            observer.observe(img);
        });
    }

    processImage(img) {
        // Create canvas to analyze the image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        // Wait for image to be fully loaded
        if (!img.complete || img.naturalWidth === 0) {
            img.addEventListener('load', () => this.processImage(img));
            return;
        }

        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;

        try {
            // Draw the image to analyze it
            ctx.drawImage(img, 0, 0);
            
            // Get image data to find content bounds
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const bounds = this.findContentBounds(imageData);
            
            if (bounds) {
                this.applySmartCrop(img, bounds);
                console.log(`📏 Auto-cropped ${img.alt}: ${bounds.width}x${bounds.height}`);
            }
        } catch (error) {
            console.warn('⚠️ Could not analyze image:', img.src, error);
            // Fallback to CSS-only cropping
            this.applyCSSOnlyCrop(img);
        }
    }

    findContentBounds(imageData) {
        const data = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        let minX = width, maxX = 0;
        let minY = height, maxY = 0;
        let hasContent = false;

        // Scan for non-transparent pixels
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const i = (y * width + x) * 4;
                const alpha = data[i + 3];
                
                // If pixel is not fully transparent
                if (alpha > 10) {
                    hasContent = true;
                    minX = Math.min(minX, x);
                    maxX = Math.max(maxX, x);
                    minY = Math.min(minY, y);
                    maxY = Math.max(maxY, y);
                }
            }
        }

        if (!hasContent) return null;

        // Add small padding around content
        const padding = 5;
        return {
            x: Math.max(0, minX - padding),
            y: Math.max(0, minY - padding),
            width: Math.min(width, maxX - minX + padding * 2),
            height: Math.min(height, maxY - minY + padding * 2)
        };
    }

    applySmartCrop(img, bounds) {
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;
        
        // Calculate crop percentages
        const cropLeft = (bounds.x / naturalWidth) * 100;
        const cropTop = (bounds.y / naturalHeight) * 100;
        const cropWidth = (bounds.width / naturalWidth) * 100;
        const cropHeight = (bounds.height / naturalHeight) * 100;
        
        // Apply CSS clip-path for precise cropping
        img.style.clipPath = `inset(${cropTop}% ${100 - cropLeft - cropWidth}% ${100 - cropTop - cropHeight}% ${cropLeft}%)`;
        
        // For fullsize images, we don't need container adjustments
        if (img.classList.contains('hole-logo-image-fullsize')) {
            console.log(`📏 Auto-cropped fullsize ${img.alt}: ${bounds.width}x${bounds.height}`);
            this.enhanceFullsizeImage(img);
            return;
        }
        
        // Legacy container adjustment for old images
        const container = img.parentElement;
        if (container && container.classList.contains('hole-logo-container')) {
            const aspectRatio = bounds.width / bounds.height;
            
            if (aspectRatio > 2) {
                // Wide logo
                container.style.maxWidth = '85%';
                container.style.maxHeight = '100px';
            } else if (aspectRatio < 0.8) {
                // Tall logo
                container.style.maxWidth = '60%';
                container.style.maxHeight = '120px';
            } else {
                // Balanced logo
                container.style.maxWidth = '75%';
                container.style.maxHeight = '110px';
            }
        }

        // Add standard enhancement
        this.enhanceImage(img);
    }

    applyCSSOnlyCrop(img) {
        // Fallback CSS-only approach
        img.style.objectFit = 'contain';
        img.style.objectPosition = 'center';
        
        // Apply a standard crop that works for most logos
        img.style.clipPath = 'inset(10% 15% 10% 15%)';
        
        console.log('📐 Applied CSS-only crop to', img.alt);
    }

    enhanceImage(img) {
        // Add subtle enhancements to make logos pop
        const enhancements = [
            'contrast(1.05)',
            'brightness(1.02)', 
            'saturate(1.1)',
            'drop-shadow(0 3px 6px rgba(0,0,0,0.3))'
        ];
        
        img.style.filter = enhancements.join(' ');
        
        // Add hover enhancement
        img.addEventListener('mouseenter', () => {
            img.style.filter = enhancements.join(' ') + ' brightness(1.1)';
        });
        
        img.addEventListener('mouseleave', () => {
            img.style.filter = enhancements.join(' ');
        });
    }

    // Method to manually process all images
    processAllImages() {
        document.querySelectorAll('.hole-logo-image').forEach(img => {
            this.processImage(img);
        });
    }

    // Reset all processed images (useful for debugging)
    reset() {
        this.processedImages.clear();
        document.querySelectorAll('.hole-logo-image').forEach(img => {
            img.style.clipPath = '';
            img.style.filter = '';
        });
        console.log('🔄 Image cropper reset');
    }
}

// Initialize the auto-cropper when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.imageCropper = new ImageAutoCropper();
});

// Make it available globally for debugging
window.ImageAutoCropper = ImageAutoCropper;
