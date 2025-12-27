const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class TextToSpeechService extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.isSpeaking = false;
        this.currentLanguage = 'en-US';
        this.currentVoice = null;
        this.speechSynthesis = null;
        this.voiceQueue = [];
        this.currentUtterance = null;
        this.audioContext = null;
        this.speechConfig = {
            rate: 1.0,
            pitch: 1.0,
            volume: 1.0,
            voice: null,
            language: 'en-US'
        };
        this.supportedLanguages = [
            { code: 'en-US', name: 'English (US)', voices: ['en-US-Wavenet-A', 'en-US-Wavenet-B', 'en-US-Wavenet-C', 'en-US-Wavenet-D', 'en-US-Wavenet-E', 'en-US-Wavenet-F'] },
            { code: 'en-GB', name: 'English (UK)', voices: ['en-GB-Wavenet-A', 'en-GB-Wavenet-B', 'en-GB-Wavenet-C', 'en-GB-Wavenet-D'] },
            { code: 'es-ES', name: 'Spanish (Spain)', voices: ['es-ES-Wavenet-A', 'es-ES-Wavenet-B'] },
            { code: 'es-MX', name: 'Spanish (Mexico)', voices: ['es-MX-Wavenet-A', 'es-MX-Wavenet-B'] },
            { code: 'zh-CN', name: 'Chinese (Simplified)', voices: ['zh-CN-Wavenet-A', 'zh-CN-Wavenet-B', 'zh-CN-Wavenet-C', 'zh-CN-Wavenet-D'] },
            { code: 'zh-TW', name: 'Chinese (Traditional)', voices: ['zh-TW-Wavenet-A', 'zh-TW-Wavenet-B', 'zh-TW-Wavenet-C'] },
            { code: 'fr-FR', name: 'French', voices: ['fr-FR-Wavenet-A', 'fr-FR-Wavenet-B', 'fr-FR-Wavenet-C', 'fr-FR-Wavenet-D'] },
            { code: 'de-DE', name: 'German', voices: ['de-DE-Wavenet-A', 'de-DE-Wavenet-B', 'de-DE-Wavenet-C', 'de-DE-Wavenet-D'] },
            { code: 'ja-JP', name: 'Japanese', voices: ['ja-JP-Wavenet-A', 'ja-JP-Wavenet-B', 'ja-JP-Wavenet-C', 'ja-JP-Wavenet-D'] },
            { code: 'ko-KR', name: 'Korean', voices: ['ko-KR-Wavenet-A', 'ko-KR-Wavenet-B', 'ko-KR-Wavenet-C'] }
        ];
        this.performanceMetrics = {
            synthesisTime: [],
            queueLength: [],
            successRate: []
        };
        this.simulationMode = true; // For demo without native dependencies
        this.availableVoices = [];
        this.voiceCharacteristics = {
            gender: 'neutral',
            age: 'adult',
            style: 'conversational'
        };
        this.emotionMapping = {
            'neutral': { rate: 1.0, pitch: 1.0, volume: 1.0 },
            'happy': { rate: 1.1, pitch: 1.2, volume: 1.1 },
            'sad': { rate: 0.9, pitch: 0.8, volume: 0.9 },
            'excited': { rate: 1.2, pitch: 1.3, volume: 1.2 },
            'calm': { rate: 0.8, pitch: 0.9, volume: 0.8 },
            'urgent': { rate: 1.3, pitch: 1.1, volume: 1.3 },
            'friendly': { rate: 1.0, pitch: 1.1, volume: 1.0 },
            'professional': { rate: 0.9, pitch: 0.9, volume: 1.0 }
        };
    }

    async initialize() {
        try {
            if (this.simulationMode) {
                console.log('Text-to-Speech Service initialized in simulation mode');
                this.isInitialized = true;
                this.setupSimulationVoices();
                this.emit('initialized');
                return;
            }
            
            // Initialize audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // Initialize speech synthesis
            if ('speechSynthesis' in window) {
                this.speechSynthesis = window.speechSynthesis;
                await this.loadVoices();
                this.setupEventListeners();
            } else {
                console.warn('Speech synthesis not available, using simulation');
                this.simulationMode = true;
                this.setupSimulationVoices();
            }
            
            // Initialize cloud TTS services
            await this.initializeCloudServices();
            
            this.isInitialized = true;
            console.log('Text-to-Speech Service initialized successfully');
            this.emit('initialized');
            
        } catch (error) {
            console.error('Text-to-Speech initialization failed:', error);
            
            // Fallback to simulation mode
            console.log('Falling back to simulation mode');
            this.simulationMode = true;
            this.setupSimulationVoices();
            this.isInitialized = true;
            this.emit('initialized');
        }
    }

    async initializeCloudServices() {
        // Initialize Google Cloud Text-to-Speech
        try {
            const textToSpeech = require('@google-cloud/text-to-speech');
            this.googleTTS = new textToSpeech.TextToSpeechClient();
            console.log('Google Cloud TTS initialized');
        } catch (error) {
            console.warn('Google Cloud TTS not available:', error.message);
        }
        
        // Initialize Azure Speech Services
        try {
            const sdk = require('microsoft-cognitiveservices-speech-sdk');
            this.azureTTS = sdk;
            console.log('Azure TTS SDK loaded');
        } catch (error) {
            console.warn('Azure TTS not available:', error.message);
        }
    }

    async loadVoices() {
        return new Promise((resolve) => {
            if (this.simulationMode) {
                this.setupSimulationVoices();
                resolve();
                return;
            }
            
            const loadVoicesHandler = () => {
                this.availableVoices = this.speechSynthesis.getVoices();
                console.log(`Loaded ${this.availableVoices.length} voices`);
                
                // Set default voice
                if (this.availableVoices.length > 0) {
                    const preferredVoices = this.availableVoices.filter(voice => 
                        voice.lang.includes(this.currentLanguage) && 
                        (voice.name.includes('Google') || voice.name.includes('Microsoft'))
                    );
                    
                    this.currentVoice = preferredVoices.length > 0 ? preferredVoices[0] : this.availableVoices[0];
                    this.speechConfig.voice = this.currentVoice;
                    this.speechConfig.language = this.currentVoice.lang;
                }
                
                resolve();
            };
            
            if (this.speechSynthesis.getVoices().length > 0) {
                loadVoicesHandler();
            } else {
                this.speechSynthesis.onvoiceschanged = loadVoicesHandler;
            }
        });
    }

    setupSimulationVoices() {
        this.availableVoices = this.supportedLanguages.map(lang => ({
            name: lang.voices[0],
            lang: lang.code,
            default: true,
            localService: true,
            voiceURI: lang.voices[0]
        }));
        
        if (this.availableVoices.length > 0) {
            this.currentVoice = this.availableVoices[0];
            this.speechConfig.voice = this.currentVoice;
            this.speechConfig.language = this.currentLanguage;
        }
    }

    setupEventListeners() {
        if (!this.speechSynthesis) return;
        
        this.speechSynthesis.onvoiceschanged = () => {
            this.loadVoices();
        };
    }

    async speak(text, options = {}) {
        if (!this.isInitialized) {
            throw new Error('Text-to-Speech service not initialized');
        }
        
        const startTime = Date.now();
        
        try {
            // Create utterance
            const utterance = await this.createUtterance(text, options);
            
            // Add to queue
            this.voiceQueue.push({
                id: uuidv4(),
                text: text,
                utterance: utterance,
                options: options,
                timestamp: startTime
            });
            
            // Process queue if not already speaking
            if (!this.isSpeaking) {
                this.processVoiceQueue();
            }
            
            return utterance.id;
            
        } catch (error) {
            console.error('Speech synthesis error:', error);
            throw error;
        }
    }

    async createUtterance(text, options) {
        const utterance = {
            id: uuidv4(),
            text: text,
            rate: options.rate || this.speechConfig.rate,
            pitch: options.pitch || this.speechConfig.pitch,
            volume: options.volume || this.speechConfig.volume,
            voice: options.voice || this.currentVoice,
            language: options.language || this.currentLanguage,
            emotion: options.emotion || 'neutral'
        };
        
        // Apply emotion-based modifications
        if (this.emotionMapping[utterance.emotion]) {
            const emotionConfig = this.emotionMapping[utterance.emotion];
            utterance.rate *= emotionConfig.rate;
            utterance.pitch *= emotionConfig.pitch;
            utterance.volume *= emotionConfig.volume;
        }
        
        // Apply language-specific adjustments
        const language = this.supportedLanguages.find(lang => lang.code === utterance.language);
        if (language) {
            // Language-specific pitch/rate adjustments
            if (utterance.language.startsWith('zh')) {
                utterance.pitch *= 1.1; // Slightly higher pitch for Chinese
            } else if (utterance.language.startsWith('ja')) {
                utterance.rate *= 0.9; // Slightly slower for Japanese
            } else if (utterance.language.startsWith('es')) {
                utterance.pitch *= 0.95; // Slightly lower pitch for Spanish
            }
        }
        
        return utterance;
    }

    updateVoiceParameters(parameters) {
        if (!this.isInitialized) {
            throw new Error('Text-to-Speech service not initialized');
        }
        
        // Update configuration
        if (parameters.rate !== undefined) {
            this.speechConfig.rate = Math.max(0.1, Math.min(3.0, parameters.rate));
        }
        
        if (parameters.pitch !== undefined) {
            this.speechConfig.pitch = Math.max(0.1, Math.min(2.0, parameters.pitch));
        }
        
        if (parameters.volume !== undefined) {
            this.speechConfig.volume = Math.max(0.0, Math.min(1.0, parameters.volume));
        }
        
        if (parameters.voice && this.availableVoices.find(v => v.name === parameters.voice)) {
            this.currentVoice = parameters.voice;
            this.speechConfig.voice = parameters.voice;
        }
        
        if (parameters.language && this.supportedLanguages.find(lang => lang.code === parameters.language)) {
            this.currentLanguage = parameters.language;
            this.speechConfig.language = parameters.language;
        }
        
        console.log('Voice parameters updated:', this.speechConfig);
        this.emit('voiceParametersUpdated', this.speechConfig);
        
        return this.speechConfig;
    }

    async processVoiceQueue() {
        if (this.voiceQueue.length === 0 || this.isSpeaking) {
            return;
        }
        
        const queueItem = this.voiceQueue.shift();
        this.currentUtterance = queueItem;
        this.isSpeaking = true;
        
        try {
            if (this.simulationMode) {
                await this.simulateSpeech(queueItem);
            } else {
                await this.synthesizeSpeech(queueItem);
            }
            
            // Update performance metrics
            const synthesisTime = Date.now() - queueItem.timestamp;
            this.updatePerformanceMetrics('synthesisTime', synthesisTime);
            this.updatePerformanceMetrics('successRate', 1);
            
            this.emit('speechCompleted', {
                id: queueItem.id,
                text: queueItem.text,
                duration: synthesisTime,
                voice: queueItem.utterance.voice?.name || 'default'
            });
            
        } catch (error) {
            console.error('Speech processing error:', error);
            this.updatePerformanceMetrics('successRate', 0);
            this.emit('speechError', {
                id: queueItem.id,
                text: queueItem.text,
                error: error.message
            });
        } finally {
            this.isSpeaking = false;
            this.currentUtterance = null;
            
            // Process next item in queue
            if (this.voiceQueue.length > 0) {
                setTimeout(() => this.processVoiceQueue(), 100);
            }
        }
    }

    async simulateSpeech(queueItem) {
        return new Promise((resolve, reject) => {
            try {
                const estimatedDuration = this.estimateSpeechDuration(queueItem.text, queueItem.utterance.rate);
                
                // Emit speech start event
                this.emit('speechStarted', {
                    id: queueItem.id,
                    text: queueItem.text,
                    duration: estimatedDuration
                });
                
                // Simulate speech progress
                const progressInterval = setInterval(() => {
                    this.emit('speechProgress', {
                        id: queueItem.id,
                        progress: Math.random() * 100
                    });
                }, 100);
                
                // Simulate speech completion
                setTimeout(() => {
                    clearInterval(progressInterval);
                    
                    // Simulate audio data for visualization
                    const audioData = this.generateSimulatedAudioData(queueItem.text);
                    
                    this.emit('audioData', {
                        id: queueItem.id,
                        data: audioData,
                        duration: estimatedDuration
                    });
                    
                    resolve();
                }, estimatedDuration);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    async synthesizeSpeech(queueItem) {
        return new Promise((resolve, reject) => {
            try {
                // Create speech synthesis utterance
                const utterance = new SpeechSynthesisUtterance(queueItem.text);
                
                // Configure utterance
                utterance.rate = queueItem.utterance.rate;
                utterance.pitch = queueItem.utterance.pitch;
                utterance.volume = queueItem.utterance.volume;
                
                if (queueItem.utterance.voice) {
                    utterance.voice = queueItem.utterance.voice;
                }
                
                if (queueItem.utterance.language) {
                    utterance.lang = queueItem.utterance.language;
                }
                
                // Set up event handlers
                utterance.onstart = () => {
                    this.emit('speechStarted', {
                        id: queueItem.id,
                        text: queueItem.text,
                        voice: queueItem.utterance.voice?.name
                    });
                };
                
                utterance.onend = () => {
                    resolve();
                };
                
                utterance.onerror = (event) => {
                    reject(new Error(`Speech synthesis error: ${event.error}`));
                };
                
                utterance.onpause = () => {
                    this.emit('speechPaused', { id: queueItem.id });
                };
                
                utterance.onresume = () => {
                    this.emit('speechResumed', { id: queueItem.id });
                };
                
                // Start speaking
                this.speechSynthesis.speak(utterance);
                
            } catch (error) {
                reject(error);
            }
        });
    }

    estimateSpeechDuration(text, rate = 1.0) {
        // Rough estimation: ~150 words per minute average speech
        const wordsPerMinute = 150 * rate;
        const wordCount = text.split(/\s+/).length;
        const minutes = wordCount / wordsPerMinute;
        return Math.max(minutes * 60 * 1000, 1000); // Minimum 1 second
    }

    generateSimulatedAudioData(text) {
        // Generate simulated audio frequency data for visualization
        const duration = this.estimateSpeechDuration(text);
        const sampleRate = 44100;
        const samples = Math.floor((duration / 1000) * sampleRate);
        
        const audioData = {
            sampleRate: sampleRate,
            duration: duration,
            channels: 1,
            samples: samples,
            frequencyData: new Uint8Array(256)
        };
        
        // Fill with simulated frequency data
        for (let i = 0; i < audioData.frequencyData.length; i++) {
            audioData.frequencyData[i] = Math.floor(Math.random() * 128 + 64);
        }
        
        return audioData;
    }

    stop() {
        if (this.simulationMode) {
            this.voiceQueue = [];
            this.isSpeaking = false;
            this.currentUtterance = null;
            return;
        }
        
        if (this.speechSynthesis) {
            this.speechSynthesis.cancel();
        }
        
        this.voiceQueue = [];
        this.isSpeaking = false;
        this.currentUtterance = null;
    }

    pause() {
        if (!this.simulationMode && this.speechSynthesis) {
            this.speechSynthesis.pause();
        }
    }

    resume() {
        if (!this.simulationMode && this.speechSynthesis) {
            this.speechSynthesis.resume();
        }
    }

    setRate(rate) {
        if (rate >= 0.1 && rate <= 3.0) {
            this.speechConfig.rate = rate;
            return true;
        }
        return false;
    }

    setPitch(pitch) {
        if (pitch >= 0.1 && pitch <= 2.0) {
            this.speechConfig.pitch = pitch;
            return true;
        }
        return false;
    }

    setVolume(volume) {
        if (volume >= 0.0 && volume <= 1.0) {
            this.speechConfig.volume = volume;
            return true;
        }
        return false;
    }

    setVoice(voice) {
        if (voice && typeof voice === 'object') {
            this.currentVoice = voice;
            this.speechConfig.voice = voice;
            return true;
        }
        return false;
    }

    switchLanguage(languageCode) {
        const language = this.supportedLanguages.find(lang => lang.code === languageCode);
        
        if (language) {
            this.currentLanguage = languageCode;
            this.speechConfig.language = languageCode;
            
            // Update voice to match language
            const voices = this.availableVoices.filter(voice => voice.lang.includes(languageCode));
            if (voices.length > 0) {
                this.setVoice(voices[0]);
            }
            
            console.log('TTS language switched to:', language.name);
            this.emit('languageChanged', languageCode);
            return true;
        }
        
        console.warn('Unsupported TTS language:', languageCode);
        return false;
    }

    updatePerformanceMetrics(metric, value) {
        this.performanceMetrics[metric].push(value);
        
        // Keep only last 1000 measurements
        if (this.performanceMetrics[metric].length > 1000) {
            this.performanceMetrics[metric].shift();
        }
    }

    getAvailableVoices() {
        return this.availableVoices.filter(voice => voice.lang.includes(this.currentLanguage));
    }

    getStatus() {
        return {
            active: this.isInitialized,
            speaking: this.isSpeaking,
            language: this.currentLanguage,
            voice: this.currentVoice?.name || 'default',
            queueLength: this.voiceQueue.length,
            currentText: this.currentUtterance?.text || '',
            simulationMode: this.simulationMode,
            supportedLanguages: this.supportedLanguages.length,
            availableVoices: this.availableVoices.length,
            configuration: {
                rate: this.speechConfig.rate,
                pitch: this.speechConfig.pitch,
                volume: this.speechConfig.volume
            },
            performance: {
                averageSynthesisTime: this.calculateAverage(this.performanceMetrics.synthesisTime),
                averageQueueLength: this.calculateAverage(this.performanceMetrics.queueLength),
                successRate: this.calculateSuccessRate(),
                totalSyntheses: this.performanceMetrics.synthesisTime.length
            }
        };
    }

    calculateAverage(array) {
        if (array.length === 0) return 0;
        return array.reduce((sum, val) => sum + val, 0) / array.length;
    }

    calculateSuccessRate() {
        const successCount = this.performanceMetrics.successRate.filter(rate => rate === 1).length;
        const totalCount = this.performanceMetrics.successRate.length;
        return totalCount > 0 ? (successCount / totalCount) * 100 : 100;
    }
}

module.exports = { TextToSpeechService };