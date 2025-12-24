const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');

// Disable GPU acceleration to prevent crashes
app.commandLine.appendSwitch('disable-gpu');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('disable-gpu-sandbox');
const { VoiceRecognitionService } = require('./services/voiceRecognition');
const { AIAssistant } = require('./services/aiAssistant');
const { EmotionDetectionService } = require('./services/emotionDetection');
const { FaceRecognitionService } = require('./services/faceRecognition');
const { TaskAutomationService } = require('./services/taskAutomation');
const { SmartHomeService } = require('./services/smartHome');
const { MultiAgentCoordinator } = require('./services/multiAgentCoordinator');
const { SecurityManager } = require('./services/securityManager');

class HolographicAIAssistant {
    constructor() {
        this.mainWindow = null;
        this.services = {
            voice: new VoiceRecognitionService(),
            ai: new AIAssistant(),
            emotion: new EmotionDetectionService(),
            face: new FaceRecognitionService(),
            automation: new TaskAutomationService(),
            smartHome: new SmartHomeService(),
            coordinator: new MultiAgentCoordinator(),
            security: new SecurityManager()
        };
        this.isListening = false;
        this.isAuthorized = false;
        this.currentMode = 'monitoring';
    }

    async initialize() {
        await app.whenReady();
        await this.createWindow();
        await this.initializeServices();
        this.setupEventHandlers();
        this.startSystem();
    }

    async createWindow() {
        const { width, height } = screen.getPrimaryDisplay().workAreaSize;
        
        this.mainWindow = new BrowserWindow({
            width: 400,
            height: 600,
            x: width - 420,
            y: height - 620,
            frame: false,
            transparent: true,
            alwaysOnTop: true,
            skipTaskbar: true,
            resizable: false,
            webPreferences: {
                nodeIntegration: true,
                contextIsolation: false,
                enableRemoteModule: true
            }
        });

        await this.mainWindow.loadFile('src/ui/index.html');
        this.mainWindow.setIgnoreMouseEvents(false);
        
        // Set up IPC handlers after window is created
        this.setupIpcHandlers();
    }
    
    setupIpcHandlers() {
        // IPC handlers
        ipcMain.handle('get-system-status', () => {
            return this.getSystemStatus();
        });

        ipcMain.handle('toggle-listening', () => {
            this.toggleListening();
        });
    }

    async initializeServices() {
        try {
            await this.services.security.initialize();
            await this.services.face.initialize();
            await this.services.voice.initialize();
            await this.services.emotion.initialize();
            await this.services.automation.initialize();
            await this.services.smartHome.initialize();
            await this.services.coordinator.initialize(this.services);
            
            console.log('All services initialized successfully');
        } catch (error) {
            console.error('Service initialization failed:', error);
        }
    }

    setupEventHandlers() {
        // Voice recognition events
        this.services.voice.on('speechDetected', (text) => {
            this.handleVoiceInput(text);
        });

        // Face recognition events
        this.services.face.on('userRecognized', (userId) => {
            this.handleUserRecognition(userId);
        });

        this.services.face.on('userAbsent', () => {
            this.handleUserAbsence();
        });

        // Emotion detection events
        this.services.emotion.on('emotionDetected', (emotion) => {
            this.handleEmotionChange(emotion);
        });

        app.on('window-all-closed', () => {
            if (process.platform !== 'darwin') {
                app.quit();
            }
        });
    }

    async startSystem() {
        console.log('Starting Holographic AI Assistant...');
        this.updateVisualState('initializing');
        
        // Start face recognition for access control
        this.services.face.startMonitoring();
        
        // Wait for user recognition before full activation
        await this.waitForUserRecognition();
        
        this.updateVisualState('online');
        this.speak("Identity confirmed. All systems online. How may I assist you, Sir?");
        
        // Start monitoring mode
        this.setMode('monitoring');
    }

    async waitForUserRecognition() {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (this.isAuthorized) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 1000);
        });
    }

    handleVoiceInput(text) {
        if (!this.isAuthorized) {
            this.speak("Access denied. Please wait for identity verification.");
            return;
        }

        console.log('Voice input detected:', text);
        this.updateVisualState('thinking');
        
        // Process through multi-agent coordinator
        this.services.coordinator.processInput(text, {
            emotion: this.services.emotion.getCurrentEmotion(),
            mode: this.currentMode,
            context: this.getContext()
        }).then(response => {
            this.handleAIResponse(response);
        }).catch(error => {
            console.error('Processing error:', error);
            this.speak("I encountered an error processing your request.");
            this.updateVisualState('online');
        });
    }

    handleAIResponse(response) {
        console.log('AI Response:', response);
        
        // Adjust response based on detected emotion
        const adjustedResponse = this.services.emotion.adjustResponse(response);
        
        this.speak(adjustedResponse.text);
        
        if (response.action) {
            this.executeAction(response.action);
        }
        
        this.updateVisualState('online');
    }

    handleUserRecognition(userId) {
        console.log('User recognized:', userId);
        this.isAuthorized = true;
        this.updateVisualState('authenticated');
    }

    handleUserAbsence() {
        console.log('User absent');
        this.isAuthorized = false;
        this.updateVisualState('locked');
        this.services.automation.lockSensitiveCapabilities();
    }

    handleEmotionChange(emotion) {
        console.log('Emotion detected:', emotion);
        this.updateVisualState('emotion_' + emotion.type);
    }

    executeAction(action) {
        switch (action.type) {
            case 'system_command':
                this.services.automation.executeCommand(action.data);
                break;
            case 'smart_home':
                this.services.smartHome.executeCommand(action.data);
                break;
            case 'mode_change':
                this.setMode(action.data.mode);
                break;
            default:
                console.log('Unknown action type:', action.type);
        }
    }

    speak(text) {
        this.updateVisualState('speaking');
        this.services.voice.speak(text).then(() => {
            this.updateVisualState('online');
        });
    }

    toggleListening() {
        this.isListening = !this.isListening;
        if (this.isListening) {
            this.services.voice.startListening();
            this.updateVisualState('listening');
        } else {
            this.services.voice.stopListening();
            this.updateVisualState('online');
        }
    }

    setMode(mode) {
        this.currentMode = mode;
        console.log('Mode changed to:', mode);
        this.updateVisualState(mode);
        this.speak(`Switched to ${mode} mode.`);
    }

    updateVisualState(state) {
        if (this.mainWindow) {
            this.mainWindow.webContents.send('visual-state-change', state);
        }
    }

    getSystemStatus() {
        return {
            isAuthorized: this.isAuthorized,
            isListening: this.isListening,
            currentMode: this.currentMode,
            emotion: this.services.emotion.getCurrentEmotion(),
            services: this.services.coordinator.getServiceStatus()
        };
    }

    getContext() {
        return {
            time: new Date().toLocaleTimeString(),
            emotion: this.services.emotion.getCurrentEmotion(),
            mode: this.currentMode,
            recentCommands: this.services.coordinator.getRecentCommands()
        };
    }
}

// Initialize the application
const assistant = new HolographicAIAssistant();
assistant.initialize().catch(console.error);