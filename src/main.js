const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { HolographicSpeechProcessor } = require('./services/holographicSpeechProcessor');
const { SpeechRecognitionService } = require('./services/speechRecognition');
const { TextToSpeechService } = require('./services/textToSpeech');
const { NoiseCancellationService } = require('./services/noiseCancellation');
const { GestureRecognitionService } = require('./services/gestureRecognition');
const { ConversationMemoryService } = require('./services/conversationMemory');
const { EmotionAnalysisService } = require('./services/emotionAnalysis');
const { UserProfileService } = require('./services/userProfile');
const { MultiUserManager } = require('./services/multiUserManager');
const { APIManager } = require('./services/apiManager');

// Disable GPU acceleration to prevent crashes
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-sandbox');

class HolographicSpeechInterface {
    constructor() {
        this.mainWindow = null;
        this.services = {
            holographic: new HolographicSpeechProcessor(),
            speechRecognition: new SpeechRecognitionService(),
            textToSpeech: new TextToSpeechService(),
            noiseCancellation: new NoiseCancellationService(),
            gestureRecognition: new GestureRecognitionService(),
            conversationMemory: new ConversationMemoryService(),
            emotionAnalysis: new EmotionAnalysisService(),
            userProfile: new UserProfileService(),
            multiUser: new MultiUserManager(),
            apiManager: new APIManager()
        };
        this.isListening = false;
        this.activeUsers = new Map();
        this.performanceMetrics = {
            responseTime: [],
            recognitionAccuracy: [],
            noiseReduction: []
        };
    }

    async initialize() {
        try {
            await this.createHolographicWindow();
            await this.initializeServices();
            this.setupEventHandlers();
            this.startPerformanceMonitoring();
            console.log('Holographic Speech Interface initialized successfully');
        } catch (error) {
            console.error('Initialization failed:', error);
        }
    }

    async createHolographicWindow() {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        
        this.mainWindow = new BrowserWindow({
            width: 240,
            height: 240,
            x: Math.floor(width / 2 - 120),
            y: Math.floor(height / 2 - 120),
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: false,
            resizable: false,
            roundedCorners: true,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                enableRemoteModule: false,
                webSecurity: false,
                allowRunningInsecureContent: true,
                preload: path.join(__dirname, 'preload.js')
            }
        });

        await this.mainWindow.loadFile('src/ui/holographic-siri.html');
        this.mainWindow.setIgnoreMouseEvents(false);
        
        // Set up IPC handlers after window is created
        this.setupIpcHandlers();
        
        console.log('Holographic window created successfully');
    }

    async initializeServices() {
        try {
            // Initialize services in dependency order
            await this.services.noiseCancellation.initialize();
            await this.services.speechRecognition.initialize();
            await this.services.textToSpeech.initialize();
            await this.services.holographic.initialize();
            await this.services.gestureRecognition.initialize();
            await this.services.conversationMemory.initialize();
            await this.services.emotionAnalysis.initialize();
            await this.services.userProfile.initialize();
            await this.services.multiUser.initialize();
            await this.services.apiManager.initialize();
            
            console.log('All services initialized successfully');
        } catch (error) {
            console.error('Service initialization failed:', error);
            throw error;
        }
    }

    setupEventHandlers() {
        // Speech recognition events
        this.services.speechRecognition.on('speechDetected', (data) => {
            this.handleSpeechInput(data);
        });

        // Gesture recognition events
        this.services.gestureRecognition.on('gestureDetected', (gesture) => {
            this.handleGestureInput(gesture);
        });

        // Multi-user events
        this.services.multiUser.on('userJoined', (userId) => {
            this.handleUserJoined(userId);
        });

        this.services.multiUser.on('userLeft', (userId) => {
            this.handleUserLeft(userId);
        });

        // Emotion analysis events
        this.services.emotionAnalysis.on('emotionDetected', (emotion) => {
            this.handleEmotionChange(emotion);
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                this.cleanup();
                app.quit();
            }
        });
    }

    setupIpcHandlers() {
        // IPC handlers for UI communication
        ipcMain.handle('get-system-status', () => {
            return this.getSystemStatus();
        });

        ipcMain.handle('toggle-listening', () => {
            this.toggleListening();
        });

        ipcMain.handle('set-wake-word', (event, wakeWord) => {
            return this.services.speechRecognition.setWakeWord(wakeWord);
        });

        ipcMain.handle('get-conversation-history', (event, userId) => {
            return this.services.conversationMemory.getHistory(userId);
        });

        ipcMain.handle('update-user-profile', (event, userId, profile) => {
            return this.services.userProfile.updateProfile(userId, profile);
        });

        ipcMain.handle('perform-api-query', (event, query) => {
            return this.services.apiManager.performQuery(query);
        });

        // Siri interface communication
        ipcMain.handle('update-listening-state', (event, isListening) => {
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('listening-state-changed', isListening);
            }
        });

        ipcMain.handle('update-speaking-state', (event, isSpeaking) => {
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('speaking-state-changed', isSpeaking);
            }
        });

        ipcMain.handle('update-emotion', (event, emotion) => {
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('emotion-updated', emotion);
            }
        });

        ipcMain.handle('update-audio-level', (event, level) => {
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('audio-level-updated', level);
            }
        });

        ipcMain.handle('show-response', (event, text) => {
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('response-display', text);
            }
        });
    }

    async handleSpeechInput(speechData) {
        const startTime = Date.now();
        
        try {
            // Update UI to show listening state
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('listening-state-changed', true);
            }
            
            // Apply noise cancellation
            const enhancedAudio = await this.services.noiseCancellation.enhance(speechData.audio);
            
            // Extract user ID if available
            const userId = speechData.userId || 'default';
            
            // Get user context
            const userContext = await this.services.userProfile.getContext(userId);
            
            // Analyze emotion
            const emotion = await this.services.emotionAnalysis.analyzeVoice(enhancedAudio);
            
            // Update emotion in UI
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('emotion-updated', emotion);
            }
            
            // Process speech to text
            const text = await this.services.speechRecognition.recognize(enhancedAudio, {
                language: userContext.language || 'en-US',
                context: userContext
            });
            
            // Store in conversation memory
            await this.services.conversationMemory.addMessage(userId, {
                type: 'user',
                text: text,
                emotion: emotion,
                timestamp: Date.now()
            });
            
            // Generate response
            const response = await this.generateResponse(text, userContext, emotion);
            
            // Update UI to show speaking state
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('listening-state-changed', false);
                this.mainWindow.webContents.send('speaking-state-changed', true);
                this.mainWindow.webContents.send('response-display', response.text);
            }
            
            // Convert response to speech
            const speechAudio = await this.services.textToSpeech.speak(response.text, {
                voice: userContext.preferredVoice || 'default',
                language: userContext.language || 'en-US',
                emotion: response.emotion
            });
            
            // Apply holographic effects
            await this.services.holographic.displayResponse(response.text, null);
            
            // Store response in memory
            await this.services.conversationMemory.addMessage(userId, {
                type: 'assistant',
                text: response.text,
                emotion: response.emotion,
                timestamp: Date.now()
            });
            
            // Update performance metrics
            const responseTime = Date.now() - startTime;
            this.updatePerformanceMetrics('responseTime', responseTime);
            
            console.log(`Speech interaction completed in ${responseTime}ms`);
            
            // Reset UI state after speaking
            setTimeout(() => {
                if (this.mainWindow && this.mainWindow.webContents) {
                    this.mainWindow.webContents.send('speaking-state-changed', false);
                }
            }, 1000);
            
        } catch (error) {
            console.error('Speech processing error:', error);
            this.handleError(error);
            
            // Reset UI state on error
            if (this.mainWindow && this.mainWindow.webContents) {
                this.mainWindow.webContents.send('listening-state-changed', false);
                this.mainWindow.webContents.send('speaking-state-changed', false);
            }
        }
    }

    async generateResponse(userText, userContext, emotion) {
        // Get conversation history for context
        const history = await this.services.conversationMemory.getRecentHistory(userContext.userId, 5);
        
        // Generate personalized response based on context and emotion
        const response = await this.services.holographic.generateResponse(userText, {
            history: history,
            userContext: userContext,
            emotion: emotion,
            language: userContext.language || 'en-US'
        });
        
        return response;
    }

    async handleGestureInput(gesture) {
        console.log('Gesture detected:', gesture.type);
        
        // Map gestures to actions
        switch (gesture.type) {
            case 'wave':
                await this.services.textToSpeech.synthesize('Hello! How can I help you?', { emotion: 'friendly' });
                break;
            case 'thumbs_up':
                await this.services.textToSpeech.synthesize('Thank you!', { emotion: 'positive' });
                break;
            case 'stop':
                this.toggleListening();
                break;
            default:
                console.log('Unknown gesture:', gesture.type);
        }
    }

    handleUserJoined(userId) {
        console.log('User joined:', userId);
        this.activeUsers.set(userId, {
            joinTime: Date.now(),
            interactions: 0
        });
        
        // Welcome new user
        this.services.textToSpeech.synthesize(`Welcome! I'm ready to assist you.`, {
            emotion: 'friendly'
        });
    }

    handleUserLeft(userId) {
        console.log('User left:', userId);
        this.activeUsers.delete(userId);
    }

    handleEmotionChange(emotion) {
        console.log('Emotion detected:', emotion);
        // Update holographic display based on emotion
        this.services.holographic.updateEmotionDisplay(emotion);
        
        // Update UI emotion
        if (this.mainWindow && this.mainWindow.webContents) {
            this.mainWindow.webContents.send('emotion-updated', emotion);
        }
    }

    toggleListening() {
        this.isListening = !this.isListening;
        
        if (this.isListening) {
            this.services.speechRecognition.startListening();
            this.services.holographic.setListeningState(true);
        } else {
            this.services.speechRecognition.stopListening();
            this.services.holographic.setListeningState(false);
        }
        
        console.log('Listening state:', this.isListening);
    }

    getSystemStatus() {
        return {
            holographic: this.services.holographic.getStatus(),
            speechRecognition: this.services.speechRecognition.getStatus(),
            textToSpeech: this.services.textToSpeech.getStatus(),
            noiseCancellation: this.services.noiseCancellation.getStatus(),
            gestureRecognition: this.services.gestureRecognition.getStatus(),
            conversationMemory: this.services.conversationMemory.getStatus(),
            emotionAnalysis: this.services.emotionAnalysis.getStatus(),
            userProfile: this.services.userProfile.getStatus(),
            multiUser: this.services.multiUser.getStatus(),
            apiManager: this.services.apiManager.getStatus(),
            performance: this.getPerformanceMetrics(),
            activeUsers: this.activeUsers.size,
            isListening: this.isListening
        };
    }

    getPerformanceMetrics() {
        return {
            averageResponseTime: this.calculateAverage(this.performanceMetrics.responseTime),
            averageAccuracy: this.calculateAverage(this.performanceMetrics.recognitionAccuracy),
            averageNoiseReduction: this.calculateAverage(this.performanceMetrics.noiseReduction),
            totalInteractions: this.performanceMetrics.responseTime.length
        };
    }

    calculateAverage(array) {
        if (array.length === 0) return 0;
        return array.reduce((sum, val) => sum + val, 0) / array.length;
    }

    updatePerformanceMetrics(metric, value) {
        this.performanceMetrics[metric].push(value);
        
        // Keep only last 1000 measurements
        if (this.performanceMetrics[metric].length > 1000) {
            this.performanceMetrics[metric].shift();
        }
    }

    startPerformanceMonitoring() {
        // Monitor system performance every 5 seconds
        setInterval(() => {
            const status = this.getSystemStatus();
            
            // Log performance warnings
            if (status.performance.averageResponseTime > 500) {
                console.warn('High response time detected:', status.performance.averageResponseTime + 'ms');
            }
            
            if (status.performance.averageAccuracy < 98) {
                console.warn('Low recognition accuracy detected:', status.performance.averageAccuracy + '%');
            }
            
        }, 5000);
    }

    handleError(error) {
        console.error('System error:', error);
        
        // Notify user of error
        this.services.textToSpeech.synthesize('I encountered an error. Please try again.', {
            emotion: 'apologetic'
        });
        
        // Log error for debugging
        // In production, this would send to error tracking service
    }

    cleanup() {
        console.log('Cleaning up resources...');
        
        // Stop all services
        this.services.speechRecognition.stop();
        this.services.textToSpeech.stop();
        this.services.noiseCancellation.stop();
        this.services.gestureRecognition.stop();
        this.services.holographic.stop();
        
        // Save conversation history
        this.services.conversationMemory.saveHistory();
        this.services.userProfile.saveProfiles();
    }
}

// Initialize the application
const holographicInterface = new HolographicSpeechInterface();

app.whenReady().then(() => {
    holographicInterface.initialize();
});

app.on('before-quit', () => {
    holographicInterface.cleanup();
});

module.exports = { HolographicSpeechInterface };