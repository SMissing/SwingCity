/**
 * Unity FEEL Recreation for Web
 * Creates juicy, polished animations that feel like Unity with FEEL asset pack
 */

class UnityFeel {
    constructor() {
        this.isAnimating = false;
        this.particles = [];
        this.sounds = {};
        this.hapticSupported = 'vibrate' in navigator;
        
        this.init();
    }

    init() {
        // Load GSAP for smooth animations
        this.loadAnimationLibraries();
        
        // Initialize particle system
        this.initParticleSystem();
        
        // Setup haptic feedback
        this.setupHaptics();
        
        console.log('🎮 Unity FEEL system initialized');
    }

    loadAnimationLibraries() {
        // GSAP will be loaded via CDN in HTML
        if (typeof gsap !== 'undefined') {
            console.log('✅ GSAP loaded successfully');
        }
    }

    // ==== BUTTON ANIMATIONS (Unity FEEL Style) ====
    
    animateButtonPress(element, callback = null) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        // Haptic feedback
        this.triggerHaptic('light');
        
        // Scale down with anticipation
        gsap.to(element, {
            scale: 0.85,
            duration: 0.1,
            ease: "power2.out",
            onComplete: () => {
                // Scale up with overshoot (FEEL bounce)
                gsap.to(element, {
                    scale: 1.05,
                    duration: 0.2,
                    ease: "back.out(1.7)",
                    onComplete: () => {
                        // Settle to normal size
                        gsap.to(element, {
                            scale: 1,
                            duration: 0.1,
                            onComplete: () => {
                                this.isAnimating = false;
                                if (callback) callback();
                            }
                        });
                    }
                });
            }
        });

        // Add button glow effect
        this.addButtonGlow(element);
    }

    animateScoreButton(element, score, par) {
        // Different animations based on score quality
        let glowColor = '#ffffff';
        let intensity = 1;

        if (score === 1) {
            glowColor = '#FFD700'; // Gold for hole-in-one
            intensity = 3;
            this.triggerCelebration('hole-in-one');
        } else if (score === par - 1) {
            glowColor = '#00FF7F'; // Green for birdie
            intensity = 2;
        } else if (score === par) {
            glowColor = '#87CEEB'; // Blue for par
            intensity = 1.5;
        }

        // Enhanced button press with color feedback
        gsap.to(element, {
            scale: 0.9,
            boxShadow: `0 0 ${20 * intensity}px ${glowColor}`,
            duration: 0.1,
            onComplete: () => {
                gsap.to(element, {
                    scale: 1.1,
                    duration: 0.15,
                    ease: "back.out(1.7)",
                    onComplete: () => {
                        gsap.to(element, {
                            scale: 1,
                            boxShadow: `0 0 ${10 * intensity}px ${glowColor}`,
                            duration: 0.1
                        });
                    }
                });
            }
        });
    }

    addButtonGlow(element) {
        gsap.to(element, {
            boxShadow: '0 0 20px rgba(138, 43, 226, 0.8)',
            duration: 0.2,
            yoyo: true,
            repeat: 1
        });
    }

    // ==== SCREEN TRANSITIONS (Unity Scene Transitions) ====
    
    transitionToState(fromState, toState, callback = null) {
        const fromElement = document.getElementById(fromState + 'State');
        const toElement = document.getElementById(toState + 'State');

        if (!fromElement || !toElement) return;

        // Slide out current state
        gsap.to(fromElement, {
            x: -window.innerWidth,
            opacity: 0,
            duration: 0.3,
            ease: "power2.in",
            onComplete: () => {
                fromElement.classList.remove('active');
                
                // Slide in new state
                toElement.classList.add('active');
                gsap.fromTo(toElement, 
                    { x: window.innerWidth, opacity: 0 },
                    { 
                        x: 0, 
                        opacity: 1, 
                        duration: 0.4, 
                        ease: "power2.out",
                        onComplete: callback
                    }
                );
            }
        });

        // Add screen flash for dramatic effect
        this.screenFlash();
    }

    // ==== CELEBRATION EFFECTS ====
    
    triggerCelebration(type) {
        switch(type) {
            case 'hole-in-one':
                this.holeInOneCelebration();
                break;
            case 'birdie':
                this.birdieCelebration();
                break;
            case 'game-complete':
                this.gameCompleteCelebration();
                break;
        }
    }

    holeInOneCelebration() {
        // Screen shake
        this.screenShake(10, 0.8);
        
        // Particle explosion
        this.createParticleExplosion(50, '#FFD700');
        
        // Screen flash
        this.screenFlash('#FFD700', 0.3);
        
        // Strong haptic
        this.triggerHaptic('heavy');
        
        console.log('🎉 HOLE IN ONE CELEBRATION!');
    }

    birdieCelebration() {
        this.screenShake(5, 0.4);
        this.createParticleExplosion(25, '#00FF7F');
        this.screenFlash('#00FF7F', 0.2);
        this.triggerHaptic('medium');
    }

    gameCompleteCelebration() {
        // Rainbow confetti
        this.createRainbowConfetti();
        this.screenShake(8, 1.0);
        this.screenFlash('#FF6B6B', 0.4);
        this.triggerHaptic('heavy');
    }

    // ==== SCREEN EFFECTS ====
    
    screenShake(intensity = 5, duration = 0.5) {
        const container = document.querySelector('.tablet-container');
        
        gsap.to(container, {
            x: `+=${intensity}`,
            y: `+=${intensity * 0.5}`,
            duration: 0.1,
            repeat: duration * 10,
            yoyo: true,
            ease: "power2.inOut",
            onComplete: () => {
                gsap.set(container, { x: 0, y: 0 });
            }
        });
    }

    screenFlash(color = '#FFFFFF', opacity = 0.3) {
        // Create flash overlay
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background-color: ${color};
            pointer-events: none;
            z-index: 9999;
            opacity: 0;
        `;
        
        document.body.appendChild(flash);
        
        gsap.to(flash, {
            opacity: opacity,
            duration: 0.1,
            onComplete: () => {
                gsap.to(flash, {
                    opacity: 0,
                    duration: 0.2,
                    onComplete: () => {
                        document.body.removeChild(flash);
                    }
                });
            }
        });
    }

    // ==== PARTICLE SYSTEM ====
    
    initParticleSystem() {
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'particles-canvas';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            pointer-events: none;
            z-index: 1000;
        `;
        
        document.body.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');
        
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
        
        this.startParticleLoop();
    }

    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    createParticleExplosion(count, color) {
        const centerX = window.innerWidth / 2;
        const centerY = window.innerHeight / 2;
        
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: centerX,
                y: centerY,
                vx: (Math.random() - 0.5) * 20,
                vy: (Math.random() - 0.5) * 20,
                life: 1.0,
                decay: Math.random() * 0.02 + 0.01,
                size: Math.random() * 8 + 4,
                color: color,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.2
            });
        }
    }

    createRainbowConfetti() {
        const colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD'];
        
        for (let i = 0; i < 100; i++) {
            this.createParticleExplosion(1, colors[Math.floor(Math.random() * colors.length)]);
        }
    }

    startParticleLoop() {
        const animate = () => {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
            
            this.particles = this.particles.filter(particle => {
                // Update particle
                particle.x += particle.vx;
                particle.y += particle.vy;
                particle.vy += 0.5; // gravity
                particle.life -= particle.decay;
                particle.rotation += particle.rotationSpeed;
                
                // Draw particle
                this.ctx.save();
                this.ctx.translate(particle.x, particle.y);
                this.ctx.rotate(particle.rotation);
                this.ctx.globalAlpha = particle.life;
                this.ctx.fillStyle = particle.color;
                this.ctx.fillRect(-particle.size/2, -particle.size/2, particle.size, particle.size);
                this.ctx.restore();
                
                return particle.life > 0;
            });
            
            requestAnimationFrame(animate);
        };
        
        animate();
    }

    // ==== HAPTIC FEEDBACK ====
    
    setupHaptics() {
        if (this.hapticSupported) {
            console.log('✅ Haptic feedback available');
        }
    }

    triggerHaptic(intensity = 'light') {
        if (!this.hapticSupported) return;
        
        const patterns = {
            light: [10],
            medium: [20],
            heavy: [50],
            double: [30, 100, 30],
            celebration: [100, 50, 100, 50, 200]
        };
        
        navigator.vibrate(patterns[intensity] || patterns.light);
    }

    // ==== UTILITY METHODS ====
    
    pulseElement(element, scale = 1.1, duration = 0.5) {
        gsap.to(element, {
            scale: scale,
            duration: duration / 2,
            yoyo: true,
            repeat: 1,
            ease: "power2.inOut"
        });
    }

    bounceIn(element, delay = 0) {
        gsap.fromTo(element,
            { scale: 0, opacity: 0 },
            { 
                scale: 1, 
                opacity: 1, 
                duration: 0.6, 
                delay: delay,
                ease: "back.out(1.7)" 
            }
        );
    }

    slideInFromBottom(element, delay = 0) {
        gsap.fromTo(element,
            { y: 100, opacity: 0 },
            { 
                y: 0, 
                opacity: 1, 
                duration: 0.5, 
                delay: delay,
                ease: "power2.out" 
            }
        );
    }

    showSuccessPopup(message, duration = 2000) {
        const popup = document.createElement('div');
        popup.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(45deg, #00FF7F, #32CD32);
            color: white;
            padding: 20px 40px;
            border-radius: 15px;
            font-size: 24px;
            font-weight: bold;
            box-shadow: 0 10px 30px rgba(0,255,127,0.3);
            z-index: 9999;
            text-align: center;
        `;
        popup.textContent = message;
        
        document.body.appendChild(popup);
        
        // Animate in
        gsap.fromTo(popup,
            { scale: 0, opacity: 0 },
            { scale: 1, opacity: 1, duration: 0.4, ease: "back.out(1.7)" }
        );
        
        // Animate out
        setTimeout(() => {
            gsap.to(popup, {
                scale: 0,
                opacity: 0,
                duration: 0.3,
                onComplete: () => {
                    document.body.removeChild(popup);
                }
            });
        }, duration);
    }
}

// Global instance
window.unityFeel = new UnityFeel();
