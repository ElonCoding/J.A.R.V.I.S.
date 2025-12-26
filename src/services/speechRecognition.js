const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

class SpeechRecognitionService extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.isListening = false;
        this.currentLanguage = 'en-US';
        this.wakeWords = ['Hey Hologram', 'Hello Assistant', 'Hi System'];
        this.activeWakeWord = null;
        this.recognitionEngines = new Map();
        this.audioContext = null;
        this.analyser = null;
        this.microphone = null;
        this.recognitionTimeout = null;
        this.confidenceThreshold = 0.85;
        this.noiseThreshold = 0.1;
        this.supportedLanguages = [
            { code: 'en-US', name: 'English (US)', engine: 'google' },
            { code: 'en-GB', name: 'English (UK)', engine: 'google' },
            { code: 'es-ES', name: 'Spanish (Spain)', engine: 'google' },
            { code: 'es-MX', name: 'Spanish (Mexico)', engine: 'google' },
            { code: 'zh-CN', name: 'Chinese (Simplified)', engine: 'azure' },
            { code: 'zh-TW', name: 'Chinese (Traditional)', engine: 'azure' },
            { code: 'fr-FR', name: 'French', engine: 'google' },
            { code: 'de-DE', name: 'German', engine: 'google' },
            { code: 'ja-JP', name: 'Japanese', engine: 'azure' },
            { code: 'ko-KR', name: 'Korean', engine: 'azure' }
        ];
        this.performanceMetrics = {
            recognitionAccuracy: [],
            processingTime: [],
            wakeWordAccuracy: []
        };
        this.simulationMode = true; // For demo without native dependencies
        this.simulationInterval = null;
        this.demoPhrases = [
            { text: "Hello hologram, how are you today?", language: "en-US", confidence: 0.95 },
            { text: "Hola asistente, ¿cómo estás?", language: "es-ES", confidence: 0.92 },
            { text: "你好助手，今天怎么样？", language: "zh-CN", confidence: 0.89 },
            { text: "What's the weather like today?", language: "en-US", confidence: 0.94 },
            { text: "¿Qué tiempo hace hoy?", language: "es-ES", confidence: 0.91 },
            { text: "今天天气怎么样？", language: "zh-CN", confidence: 0.88 }
        ];
    }

    async initialize() {
        try {
            if (this.simulationMode) {
                console.log('Speech Recognition Service initialized in simulation mode');
                this.isInitialized = true;
                this.emit('initialized');
                return;
            }
            
            // Initialize audio context
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.analyser = this.audioContext.createAnalyser();
            this.analyser.fftSize = 2048;
            this.analyser.smoothingTimeConstant = 0.8;
            
            // Initialize recognition engines
            await this.initializeRecognitionEngines();
            
            // Setup microphone access
            await this.setupMicrophone();
            
            this.isInitialized = true;
            console.log('Speech Recognition Service initialized successfully');
            this.emit('initialized');
            
        } catch (error) {
            console.error('Speech Recognition initialization failed:', error);
            
            // Fallback to simulation mode
            console.log('Falling back to simulation mode');
            this.simulationMode = true;
            this.isInitialized = true;
            this.emit('initialized');
        }
    }

    async initializeRecognitionEngines() {
        // Initialize Google Cloud Speech-to-Text
        try {
            const speech = require('@google-cloud/speech');
            const client = new speech.SpeechClient();
            
            this.recognitionEngines.set('google', {
                client: client,
                config: {
                    encoding: 'LINEAR16',
                    sampleRateHertz: 16000,
                    languageCode: this.currentLanguage,
                    enableAutomaticPunctuation: true,
                    enableWordTimeOffsets: true,
                    model: 'latest_long',
                    useEnhanced: true
                }
            });
            
            console.log('Google Speech-to-Text initialized');
        } catch (error) {
            console.warn('Google Speech-to-Text not available:', error.message);
        }
        
        // Initialize Azure Speech Services
        try {
            const sdk = require('microsoft-cognitiveservices-speech-sdk');
            const speechConfig = sdk.SpeechConfig.fromSubscription(
                process.env.AZURE_SPEECH_KEY,
                process.env.AZURE_SPEECH_REGION
            );
            
            this.recognitionEngines.set('azure', {
                sdk: sdk,
                config: speechConfig,
                recognizer: null
            });
            
            console.log('Azure Speech Services initialized');
        } catch (error) {
            console.warn('Azure Speech Services not available:', error.message);
        }
    }

    async setupMicrophone() {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 16000,
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            
            this.microphone = this.audioContext.createMediaStreamSource(stream);
            this.microphone.connect(this.analyser);
            
            console.log('Microphone access granted');
        } catch (error) {
            console.error('Microphone access denied:', error);
            throw error;
        }
    }

    async startListening() {
        if (!this.isInitialized) {
            throw new Error('Speech recognition not initialized');
        }
        
        if (this.isListening) {
            console.log('Already listening');
            return;
        }
        
        this.isListening = true;
        
        if (this.simulationMode) {
            this.startSimulation();
        } else {
            this.startRealRecognition();
        }
        
        console.log('Speech recognition started');
        this.emit('listeningStarted');
    }

    stopListening() {
        if (!this.isListening) {
            return;
        }
        
        this.isListening = false;
        
        if (this.simulationMode) {
            this.stopSimulation();
        } else {
            this.stopRealRecognition();
        }
        
        console.log('Speech recognition stopped');
        this.emit('listeningStopped');
    }

    startSimulation() {
        // Simulate speech recognition with demo phrases
        this.simulationInterval = setInterval(() => {
            if (!this.isListening) return;
            
            // Random chance of detecting speech
            if (Math.random() < 0.3) {
                const phrase = this.demoPhrases[Math.floor(Math.random() * this.demoPhrases.length)];
                
                // Check for wake word
                const hasWakeWord = this.wakeWords.some(wakeWord => 
                    phrase.text.toLowerCase().includes(wakeWord.toLowerCase().split(' ')[0])
                );
                
                const speechData = {
                    text: phrase.text,
                    confidence: phrase.confidence,
                    language: phrase.language,
                    userId: 'simulated_user',
                    timestamp: Date.now(),
                    isWakeWord: hasWakeWord,
                    alternatives: [
                        { text: phrase.text, confidence: phrase.confidence * 0.9 },
                        { text: phrase.text.toLowerCase(), confidence: phrase.confidence * 0.8 }
                    ]
                };
                
                this.processSpeechResult(speechData);
            }
        }, 3000 + Math.random() * 2000); // Random interval between 3-5 seconds
    }

    stopSimulation() {
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
            this.simulationInterval = null;
        }
    }

    startRealRecognition() {
        const engine = this.getRecognitionEngine();
        
        if (engine.name === 'google') {
            this.startGoogleRecognition(engine);
        } else if (engine.name === 'azure') {
            this.startAzureRecognition(engine);
        } else {
            this.startWebKitRecognition();
        }
    }

    stopRealRecognition() {
        // Stop all recognition engines
        this.recognitionEngines.forEach((engine, name) => {
            if (engine.recognizer && engine.recognizer.stop) {
                engine.recognizer.stop();
            }
        });
        
        if (this.recognitionTimeout) {
            clearTimeout(this.recognitionTimeout);
            this.recognitionTimeout = null;
        }
    }

    startGoogleRecognition(engine) {
        // Implementation for Google Cloud Speech-to-Text streaming
        console.log('Starting Google Speech-to-Text recognition');
        
        // This would implement real-time streaming recognition
        // For now, we'll use simulation
        this.simulationMode = true;
        this.startSimulation();
    }

    startAzureRecognition(engine) {
        // Implementation for Azure Speech Services
        console.log('Starting Azure Speech Services recognition');
        
        const audioConfig = engine.sdk.AudioConfig.fromDefaultMicrophoneInput();
        const recognizer = new engine.sdk.SpeechRecognizer(engine.config, audioConfig);
        
        recognizer.recognizing = (s, e) => {
            console.log(`Recognizing: ${e.result.text}`);
        };
        
        recognizer.recognized = (s, e) => {
            if (e.result.reason === engine.sdk.ResultReason.RecognizedSpeech) {
                this.processSpeechResult({
                    text: e.result.text,
                    confidence: e.result.confidence || 0.9,
                    language: this.currentLanguage,
                    userId: 'azure_user',
                    timestamp: Date.now()
                });
            }
        };
        
        recognizer.startContinuousRecognitionAsync();
        engine.recognizer = recognizer;
    }

    startWebKitRecognition() {
        // Fallback to Web Speech API
        if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
            console.warn('Web Speech API not available, using simulation');
            this.simulationMode = true;
            this.startSimulation();
            return;
        }
        
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = this.currentLanguage;
        recognition.maxAlternatives = 3;
        
        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                const confidence = event.results[i][0].confidence;
                
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }
            
            if (finalTranscript) {
                this.processSpeechResult({
                    text: finalTranscript,
                    confidence: confidence,
                    language: this.currentLanguage,
                    userId: 'webkit_user',
                    timestamp: Date.now(),
                    alternatives: Array.from(event.results[event.results.length - 1])
                        .map(result => ({ text: result.transcript, confidence: result.confidence }))
                });
            }
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            this.emit('error', event.error);
        };
        
        recognition.onend = () => {
            if (this.isListening) {
                // Restart recognition if still listening
                setTimeout(() => {
                    if (this.isListening) {
                        recognition.start();
                    }
                }, 100);
            }
        };
        
        recognition.start();
    }

    processSpeechResult(result) {
        const startTime = Date.now();
        
        try {
            // Check confidence threshold
            if (result.confidence < this.confidenceThreshold) {
                console.warn('Low confidence speech detected:', result.confidence);
                return;
            }
            
            // Check for wake word
            const wakeWordDetected = this.detectWakeWord(result.text);
            
            if (wakeWordDetected) {
                console.log('Wake word detected:', wakeWordDetected);
                this.activeWakeWord = wakeWordDetected;
                this.emit('wakeWordDetected', wakeWordDetected);
            }
            
            // Process the speech
            const processedResult = {
                ...result,
                wakeWord: wakeWordDetected,
                processedText: this.cleanText(result.text),
                userId: result.userId || this.generateUserId(),
                processingTime: Date.now() - startTime
            };
            
            // Update performance metrics
            this.updatePerformanceMetrics('recognitionAccuracy', result.confidence);
            this.updatePerformanceMetrics('processingTime', processedResult.processingTime);
            
            console.log('Speech processed:', processedResult.text, 
                       'Confidence:', processedResult.confidence,
                       'Time:', processedResult.processingTime + 'ms');
            
            this.emit('speechDetected', processedResult);
            
        } catch (error) {
            console.error('Speech processing error:', error);
            this.emit('error', error);
        }
    }

    detectWakeWord(text) {
        const lowerText = text.toLowerCase();
        
        for (const wakeWord of this.wakeWords) {
            const lowerWakeWord = wakeWord.toLowerCase();
            if (lowerText.includes(lowerWakeWord)) {
                return wakeWord;
            }
        }
        
        return null;
    }

    cleanText(text) {
        // Remove wake words from text
        let cleanedText = text;
        
        this.wakeWords.forEach(wakeWord => {
            const regex = new RegExp(wakeWord, 'gi');
            cleanedText = cleanedText.replace(regex, '').trim();
        });
        
        return cleanedText;
    }

    async recognize(audioData, options = {}) {
        const language = options.language || this.currentLanguage;
        const context = options.context || {};
        
        try {
            // Simulate recognition processing
            const startTime = Date.now();
            
            // In real implementation, this would process actual audio data
            const recognitionResult = {
                text: 'Simulated recognition result',
                confidence: 0.9,
                language: language,
                alternatives: [
                    { text: 'Alternative 1', confidence: 0.8 },
                    { text: 'Alternative 2', confidence: 0.7 }
                ],
                processingTime: Date.now() - startTime
            };
            
            return recognitionResult.text;
            
        } catch (error) {
            console.error('Recognition error:', error);
            throw error;
        }
    }

    setWakeWord(wakeWord) {
        if (typeof wakeWord === 'string' && wakeWord.trim().length > 0) {
            this.wakeWords = [wakeWord.trim()];
            console.log('Wake word updated:', wakeWord);
            return true;
        }
        return false;
    }

    addWakeWord(wakeWord) {
        if (typeof wakeWord === 'string' && wakeWord.trim().length > 0) {
            const trimmed = wakeWord.trim();
            if (!this.wakeWords.includes(trimmed)) {
                this.wakeWords.push(trimmed);
                console.log('Wake word added:', trimmed);
                return true;
            }
        }
        return false;
    }

    removeWakeWord(wakeWord) {
        const index = this.wakeWords.indexOf(wakeWord);
        if (index > -1) {
            this.wakeWords.splice(index, 1);
            console.log('Wake word removed:', wakeWord);
            return true;
        }
        return false;
    }

    switchLanguage(languageCode) {
        const language = this.supportedLanguages.find(lang => lang.code === languageCode);
        
        if (language) {
            this.currentLanguage = languageCode;
            console.log('Language switched to:', language.name);
            this.emit('languageChanged', languageCode);
            return true;
        }
        
        console.warn('Unsupported language:', languageCode);
        return false;
    }

    getRecognitionEngine() {
        const language = this.supportedLanguages.find(lang => lang.code === this.currentLanguage);
        
        if (language && this.recognitionEngines.has(language.engine)) {
            return {
                name: language.engine,
                ...this.recognitionEngines.get(language.engine)
            };
        }
        
        // Default to WebKit recognition
        return { name: 'webkit' };
    }

    generateUserId() {
        return 'user_' + Math.random().toString(36).substr(2, 9);
    }

    updatePerformanceMetrics(metric, value) {
        this.performanceMetrics[metric].push(value);
        
        // Keep only last 1000 measurements
        if (this.performanceMetrics[metric].length > 1000) {
            this.performanceMetrics[metric].shift();
        }
    }

    getStatus() {
        return {
            active: this.isInitialized,
            listening: this.isListening,
            language: this.currentLanguage,
            wakeWords: this.wakeWords,
            activeWakeWord: this.activeWakeWord,
            simulationMode: this.simulationMode,
            supportedLanguages: this.supportedLanguages.length,
            recognitionEngines: Array.from(this.recognitionEngines.keys()),
            performance: {
                averageAccuracy: this.calculateAverage(this.performanceMetrics.recognitionAccuracy),
                averageProcessingTime: this.calculateAverage(this.performanceMetrics.processingTime),
                averageWakeWordAccuracy: this.calculateAverage(this.performanceMetrics.wakeWordAccuracy),
                totalRecognitions: this.performanceMetrics.recognitionAccuracy.length
            }
        };
    }

    calculateAverage(array) {
        if (array.length === 0) return 0;
        return array.reduce((sum, val) => sum + val, 0) / array.length;
    }

    stop() {
        this.stopListening();
        
        if (this.audioContext) {
            this.audioContext.close();
        }
        
        console.log('Speech Recognition Service stopped');
    }
}

module.exports = { SpeechRecognitionService };