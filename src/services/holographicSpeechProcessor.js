const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

// Conditionally import THREE - only available in browser environment
let THREE = null;
if (typeof window !== 'undefined') {
    try {
        THREE = require('three');
    } catch (error) {
        console.warn('THREE.js not available, running in simulation mode');
    }
}

class HolographicSpeechProcessor extends EventEmitter {
    constructor() {
        super();
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.hologramMesh = null;
        this.particleSystem = null;
        this.isInitialized = false;
        this.isListening = false;
        this.isSpeaking = false;
        this.currentEmotion = 'neutral';
        this.voiceVisualization = null;
        this.responseQueue = [];
        this.animationFrameId = null;
        this.audioAnalyser = null;
        this.frequencyData = null;
        this.time = 0;
        this.holographicEffects = {
            hologramShader: null,
            particleShader: null,
            voiceShader: null
        };
    }

    async initialize() {
        try {
            // Check if we're in a browser environment with THREE.js available
            if (THREE && typeof window !== 'undefined') {
                await this.setup3DScene();
                await this.createHolographicAvatar();
                await this.setupVoiceVisualization();
                await this.setupParticleSystem();
                this.setupAudioProcessing();
                this.startAnimationLoop();
            } else {
                // Simulation mode for Node.js testing
                console.log('Running in simulation mode - 3D features disabled');
                this.setupSimulationMode();
            }
            
            this.isInitialized = true;
            console.log('Holographic Speech Processor initialized successfully');
            this.emit('initialized');
        } catch (error) {
            console.error('Holographic initialization failed:', error);
            throw error;
        }
    }

    async setup3DScene() {
        // Create Three.js scene
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({ 
            antialias: true, 
            alpha: true,
            powerPreference: 'high-performance'
        });
        
        this.renderer.setSize(800, 600);
        this.renderer.setClearColor(0x000000, 0);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Position camera
        this.camera.position.set(0, 0, 5);
        this.camera.lookAt(0, 0, 0);
        
        // Add lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4);
        this.scene.add(ambientLight);
        
        const directionalLight = new THREE.DirectionalLight(0x00ffff, 1);
        directionalLight.position.set(5, 5, 5);
        directionalLight.castShadow = true;
        this.scene.add(directionalLight);
        
        // Add point lights for holographic effect
        const pointLight1 = new THREE.PointLight(0x00ffff, 0.8, 10);
        pointLight1.position.set(-3, 2, 3);
        this.scene.add(pointLight1);
        
        const pointLight2 = new THREE.PointLight(0xff00ff, 0.6, 8);
        pointLight2.position.set(3, -2, 3);
        this.scene.add(pointLight2);
    }

    async createHolographicAvatar() {
        // Create holographic avatar geometry
        const geometry = new THREE.SphereGeometry(1, 32, 32);
        
        // Create holographic shader material
        const vertexShader = `
            varying vec2 vUv;
            varying vec3 vPosition;
            uniform float time;
            
            void main() {
                vUv = uv;
                vPosition = position;
                
                vec3 pos = position;
                pos.y += sin(time * 2.0 + position.x * 3.0) * 0.1;
                pos.x += cos(time * 1.5 + position.y * 2.0) * 0.05;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform float time;
            uniform float opacity;
            uniform vec3 color;
            varying vec2 vUv;
            varying vec3 vPosition;
            
            void main() {
                float scanline = sin(vUv.y * 50.0 + time * 3.0) * 0.1;
                float glow = 1.0 - length(vUv - 0.5) * 2.0;
                float flicker = sin(time * 10.0) * 0.1 + 0.9;
                
                vec3 finalColor = color + scanline;
                float alpha = opacity * glow * flicker;
                
                gl_FragColor = vec4(finalColor, alpha);
            }
        `;
        
        const material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                time: { value: 0 },
                opacity: { value: 0.8 },
                color: { value: new THREE.Color(0x00ffff) }
            },
            transparent: true,
            side: THREE.DoubleSide
        });
        
        this.hologramMesh = new THREE.Mesh(geometry, material);
        this.hologramMesh.castShadow = true;
        this.scene.add(this.hologramMesh);
        
        // Store shader reference
        this.holographicEffects.hologramShader = material;
    }

    async setupVoiceVisualization() {
        // Create voice visualization geometry
        const geometry = new THREE.RingGeometry(1.2, 1.5, 64);
        
        const vertexShader = `
            varying vec2 vUv;
            uniform float time;
            uniform float audioLevel;
            
            void main() {
                vUv = uv;
                
                vec3 pos = position;
                float angle = atan(pos.y, pos.x);
                float radius = length(pos.xy);
                
                // Audio-reactive displacement
                pos.z += sin(angle * 8.0 + time * 5.0) * audioLevel * 0.2;
                
                gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
            }
        `;
        
        const fragmentShader = `
            uniform float time;
            uniform float audioLevel;
            varying vec2 vUv;
            
            void main() {
                float ring = smoothstep(0.0, 0.1, vUv.x) * smoothstep(1.0, 0.9, vUv.x);
                float pulse = sin(time * 8.0 + vUv.x * 20.0) * 0.5 + 0.5;
                
                vec3 color = vec3(0.0, 1.0, 1.0) * (pulse + audioLevel);
                float alpha = ring * (0.5 + audioLevel * 0.5);
                
                gl_FragColor = vec4(color, alpha);
            }
        `;
        
        const material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                time: { value: 0 },
                audioLevel: { value: 0 }
            },
            transparent: true,
            side: THREE.DoubleSide
        });
        
        this.voiceVisualization = new THREE.Mesh(geometry, material);
        this.scene.add(this.voiceVisualization);
        
        this.holographicEffects.voiceShader = material;
    }

    async setupParticleSystem() {
        const particleCount = 1000;
        const geometry = new THREE.BufferGeometry();
        
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        
        for (let i = 0; i < particleCount; i++) {
            // Random positions in sphere
            const radius = Math.random() * 5;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.random() * Math.PI;
            
            positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i * 3 + 2] = radius * Math.cos(phi);
            
            // Holographic colors
            colors[i * 3] = 0.0 + Math.random() * 0.5;     // R
            colors[i * 3 + 1] = 0.5 + Math.random() * 0.5; // G
            colors[i * 3 + 2] = 1.0;                        // B
            
            sizes[i] = Math.random() * 3 + 1;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        
        const vertexShader = `
            attribute float size;
            attribute vec3 color;
            varying vec3 vColor;
            uniform float time;
            
            void main() {
                vColor = color;
                
                vec3 pos = position;
                pos.y += sin(time + position.x * 2.0) * 0.1;
                pos.x += cos(time * 0.8 + position.y * 1.5) * 0.05;
                
                vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                gl_PointSize = size * (300.0 / -mvPosition.z);
                gl_Position = projectionMatrix * mvPosition;
            }
        `;
        
        const fragmentShader = `
            varying vec3 vColor;
            
            void main() {
                float dist = length(gl_PointCoord - vec2(0.5));
                if (dist > 0.5) discard;
                
                float alpha = 1.0 - (dist * 2.0);
                gl_FragColor = vec4(vColor, alpha * 0.8);
            }
        `;
        
        const material = new THREE.ShaderMaterial({
            vertexShader: vertexShader,
            fragmentShader: fragmentShader,
            uniforms: {
                time: { value: 0 }
            },
            transparent: true,
            vertexColors: true
        });
        
        this.particleSystem = new THREE.Points(geometry, material);
        this.scene.add(this.particleSystem);
        
        this.holographicEffects.particleShader = material;
    }

    setupAudioProcessing() {
        // Create audio context for real-time processing
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        this.audioAnalyser = this.audioContext.createAnalyser();
        this.audioAnalyser.fftSize = 256;
        this.frequencyData = new Uint8Array(this.audioAnalyser.frequencyBinCount);
    }

    startAnimationLoop() {
        const animate = () => {
            this.animationFrameId = requestAnimationFrame(animate);
            this.time += 0.01;
            
            // Update holographic effects
            this.updateHolographicEffects();
            
            // Update voice visualization
            this.updateVoiceVisualization();
            
            // Update particle system
            this.updateParticleSystem();
            
            // Render scene
            this.renderer.render(this.scene, this.camera);
        };
        
        animate();
    }

    updateHolographicEffects() {
        if (this.holographicEffects.hologramShader) {
            this.holographicEffects.hologramShader.uniforms.time.value = this.time;
        }
        
        if (this.holographicEffects.particleShader) {
            this.holographicEffects.particleShader.uniforms.time.value = this.time;
        }
        
        // Rotate hologram slowly
        if (this.hologramMesh) {
            this.hologramMesh.rotation.y += 0.005;
            this.hologramMesh.rotation.x = Math.sin(this.time * 0.5) * 0.1;
        }
    }

    updateVoiceVisualization() {
        if (this.voiceVisualization && this.holographicEffects.voiceShader) {
            // Get audio level from frequency data
            let audioLevel = 0;
            if (this.frequencyData) {
                const sum = this.frequencyData.reduce((a, b) => a + b, 0);
                audioLevel = sum / (this.frequencyData.length * 255);
            }
            
            this.holographicEffects.voiceShader.uniforms.audioLevel.value = audioLevel;
            this.holographicEffects.voiceShader.uniforms.time.value = this.time;
            
            // Scale voice visualization based on audio
            const scale = 1 + audioLevel * 0.3;
            this.voiceVisualization.scale.set(scale, scale, scale);
            this.voiceVisualization.rotation.z += audioLevel * 0.1;
        }
    }

    updateParticleSystem() {
        if (this.particleSystem && this.holographicEffects.particleShader) {
            this.holographicEffects.particleShader.uniforms.time.value = this.time;
            
            // Rotate particle system
            this.particleSystem.rotation.y += 0.002;
            this.particleSystem.rotation.x += 0.001;
        }
    }

    async displayResponse(text, audioData) {
        try {
            // Update holographic text display
            this.updateHolographicText(text);
            
            // Process audio data for visualization
            if (audioData && this.audioAnalyser) {
                const source = this.audioContext.createBufferSource();
                source.buffer = audioData;
                source.connect(this.audioAnalyser);
                this.audioAnalyser.connect(this.audioContext.destination);
                source.start();
                
                // Monitor audio levels
                this.monitorAudioLevels();
            }
            
            // Trigger holographic response animation
            this.triggerResponseAnimation();
            
            console.log('Holographic response displayed:', text);
            
        } catch (error) {
            console.error('Display response error:', error);
        }
    }

    updateHolographicText(text) {
        // This would be implemented with 3D text geometry
        // For now, we'll emit an event for the UI to handle
        this.emit('textUpdate', text);
    }

    monitorAudioLevels() {
        const updateLevels = () => {
            if (this.audioAnalyser && this.frequencyData) {
                this.audioAnalyser.getByteFrequencyData(this.frequencyData);
                
                // Calculate overall audio level
                const sum = this.frequencyData.reduce((a, b) => a + b, 0);
                const audioLevel = sum / (this.frequencyData.length * 255);
                
                // Update voice visualization
                if (this.holographicEffects.voiceShader) {
                    this.holographicEffects.voiceShader.uniforms.audioLevel.value = audioLevel;
                }
                
                // Continue monitoring if speaking
                if (this.isSpeaking) {
                    requestAnimationFrame(updateLevels);
                }
            }
        };
        
        updateLevels();
    }

    triggerResponseAnimation() {
        // Animate hologram for response
        if (this.hologramMesh) {
            // Check if we have a real 3D object or simulation mock
            if (this.hologramMesh.scale && typeof this.hologramMesh.scale.clone === 'function') {
                // Real 3D object
                const originalScale = this.hologramMesh.scale.clone();
                this.hologramMesh.scale.multiplyScalar(1.2);
                
                setTimeout(() => {
                    if (this.hologramMesh && this.hologramMesh.scale) {
                        this.hologramMesh.scale.copy(originalScale);
                    }
                }, 200);
            } else {
                // Simulation mock - just log the action
                console.log('🎭 Hologram response animation triggered (simulation)');
            }
        }
        
        // Animate particles
        if (this.particleSystem) {
            if (this.particleSystem.rotation && typeof this.particleSystem.rotation.clone === 'function') {
                // Real 3D object
                const originalRotation = this.particleSystem.rotation.clone();
                this.particleSystem.rotation.z += Math.PI * 0.5;
            
                setTimeout(() => {
                    if (this.particleSystem && this.particleSystem.rotation) {
                        this.particleSystem.rotation.copy(originalRotation);
                    }
                }, 500);
            } else {
                // Simulation mock - just log the action
                console.log('✨ Particle response animation triggered (simulation)');
            }
        }
    }

    updateEmotionDisplay(emotion) {
        this.currentEmotion = emotion;
        
        // Update holographic color based on emotion
        let color;
        
        if (typeof global !== 'undefined' && global.THREE || typeof window !== 'undefined' && window.THREE) {
            // Browser environment with THREE.js
            const THREE = global.THREE || window.THREE;
            color = new THREE.Color(0x00ffff); // Default cyan
            
            switch (emotion) {
                case 'happy':
                    color = new THREE.Color(0x00ff00); // Green
                    break;
                case 'sad':
                    color = new THREE.Color(0x0000ff); // Blue
                    break;
                case 'angry':
                    color = new THREE.Color(0xff0000); // Red
                    break;
                case 'surprised':
                    color = new THREE.Color(0xffff00); // Yellow
                    break;
                case 'neutral':
                default:
                    color = new THREE.Color(0x00ffff); // Cyan
                    break;
            }
        } else {
            // Node.js simulation mode - use RGB values
            color = { r: 0, g: 1, b: 1 }; // Default cyan
            
            switch (emotion) {
                case 'happy':
                    color = { r: 0, g: 1, b: 0 }; // Green
                    break;
                case 'sad':
                    color = { r: 0, g: 0, b: 1 }; // Blue
                    break;
                case 'angry':
                    color = { r: 1, g: 0, b: 0 }; // Red
                    break;
                case 'surprised':
                    color = { r: 1, g: 1, b: 0 }; // Yellow
                    break;
                case 'neutral':
                default:
                    color = { r: 0, g: 1, b: 1 }; // Cyan
                    break;
            }
        }
        
        if (this.holographicEffects.hologramShader) {
            this.holographicEffects.hologramShader.uniforms.color.value = color;
        }
        
        this.emit('emotionUpdate', emotion);
    }

    setListeningState(isListening) {
        this.isListening = isListening;
        
        if (isListening) {
            // Start listening animation
            this.updateEmotionDisplay('neutral');
        } else {
            // Stop listening animation
            this.updateEmotionDisplay('idle');
        }
    }

    setSpeakingState(isSpeaking) {
        this.isSpeaking = isSpeaking;
        
        if (isSpeaking) {
            // Start speaking animation
            this.startVoiceVisualization();
        } else {
            // Stop speaking animation
            this.stopVoiceVisualization();
        }
    }

    startVoiceVisualization() {
        // Enable voice visualization
        if (this.voiceVisualization) {
            this.voiceVisualization.visible = true;
        }
    }

    stopVoiceVisualization() {
        // Disable voice visualization
        if (this.voiceVisualization) {
            this.voiceVisualization.visible = false;
        }
        
        // Reset audio level
        if (this.holographicEffects.voiceShader) {
            this.holographicEffects.voiceShader.uniforms.audioLevel.value = 0;
        }
    }

    async generateResponse(userText, context) {
        try {
            // Generate contextual response
            const response = {
                text: '',
                emotion: 'neutral',
                confidence: 0.9,
                responseId: uuidv4()
            };
            
            // Simple response generation (would be enhanced with AI)
            if (userText.toLowerCase().includes('hello') || userText.toLowerCase().includes('hi')) {
                response.text = 'Hello! I am your holographic assistant. How may I help you?';
                response.emotion = 'friendly';
            } else if (userText.toLowerCase().includes('how are you')) {
                response.text = 'I am functioning optimally. Thank you for asking!';
                response.emotion = 'positive';
            } else if (userText.toLowerCase().includes('thank')) {
                response.text = 'You are welcome! Is there anything else I can assist you with?';
                response.emotion = 'grateful';
            } else {
                response.text = 'I understand. Let me process that information for you.';
                response.emotion = 'thoughtful';
            }
            
            // Personalize based on user context
            if (context.userContext) {
                const userName = context.userContext.name || 'User';
                response.text = response.text.replace('you', userName);
            }
            
            return response;
            
        } catch (error) {
            console.error('Response generation error:', error);
            return {
                text: 'I apologize, but I encountered an error processing your request.',
                emotion: 'apologetic',
                confidence: 0.5,
                responseId: uuidv4()
            };
        }
    }

    getStatus() {
        return {
            active: this.isInitialized,
            listening: this.isListening,
            speaking: this.isSpeaking,
            currentEmotion: this.currentEmotion,
            hologramVisible: this.hologramMesh !== null,
            particlesVisible: this.particleSystem !== null,
            voiceVisualizationActive: this.voiceVisualization !== null && this.voiceVisualization.visible,
            audioContextActive: this.audioContext !== null && this.audioContext.state === 'running'
        };
    }

    stop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        if (this.audioContext && typeof this.audioContext.close === 'function') {
            this.audioContext.close();
        }
        
        if (this.renderer && typeof this.renderer.dispose === 'function') {
            this.renderer.dispose();
        }
        
        this.isInitialized = false;
        console.log('Holographic Speech Processor stopped');
    }

    setupSimulationMode() {
        // Simulation mode for Node.js testing without 3D dependencies
        console.log('Setting up holographic simulation mode');
        
        // Create mock objects for testing
        this.hologramMesh = { visible: true, scale: { set: () => {} }, rotation: { x: 0, y: 0, z: 0 } };
        this.particleSystem = { visible: true, rotation: { x: 0, y: 0, z: 0 } };
        this.voiceVisualization = { visible: false, scale: { set: () => {} }, rotation: { z: 0 } };
        this.renderer = { dispose: () => {} };
        this.scene = { add: () => {}, remove: () => {} };
        this.camera = { position: { set: () => {} } };
        this.audioContext = { state: 'running', createBufferSource: () => ({ connect: () => {}, start: () => {} }) };
        this.audioAnalyser = { getByteFrequencyData: () => {} };
        this.frequencyData = new Uint8Array(256);
        
        // Mock holographic effects
        this.holographicEffects = {
            hologramShader: { uniforms: { color: { value: { r: 0, g: 1, b: 1 } }, time: { value: 0 } } },
            voiceShader: { uniforms: { audioLevel: { value: 0 }, time: { value: 0 } } },
            particleShader: { uniforms: { time: { value: 0 } } }
        };
        
        // Start simulation animation loop
        this.startSimulationAnimation();
    }

    startSimulationAnimation() {
        const animate = () => {
            this.time += 0.016; // ~60fps
            
            // Simulate holographic animations
            if (this.isSpeaking && this.holographicEffects.voiceShader) {
                this.holographicEffects.voiceShader.uniforms.audioLevel.value = 
                    0.3 + 0.2 * Math.sin(this.time * 10);
            }
            
            // Simulate particle rotation
            if (this.particleSystem) {
                this.particleSystem.rotation.y += 0.002;
                this.particleSystem.rotation.x += 0.001;
            }
            
            // Continue simulation
            if (this.isInitialized) {
                setTimeout(() => animate(), 16);
            }
        };
        
        animate();
    }
}

module.exports = { HolographicSpeechProcessor };