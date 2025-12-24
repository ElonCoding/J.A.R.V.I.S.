const EventEmitter = require('events');
const path = require('path');
const fs = require('fs').promises;

class FaceRecognitionService extends EventEmitter {
    constructor() {
        super();
        this.videoCapture = null;
        this.faceClassifier = null;
        this.eyeClassifier = null;
        this.recognizedUsers = new Map();
        this.authorizedUsers = new Set();
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.lastRecognitionTime = 0;
        this.recognitionThreshold = 0.6;
        this.absenceTimeout = 30000; // 30 seconds
        this.lastSeenTime = Date.now();
        this.cameraIndex = 0;
        this.maxFailedAttempts = 3;
        this.failedAttempts = new Map();
        this.lockoutDuration = 5 * 60 * 1000; // 5 minutes
        this.isInitialized = false;
        this.simulationMode = true; // Enable simulation mode for demo
        
        // Demo users for testing
        this.demoUsers = [
            { id: 'user_001', name: 'Authorized User 1', confidence: 0.85 },
            { id: 'user_002', name: 'Authorized User 2', confidence: 0.78 }
        ];
    }
    
    async initialize() {
        try {
            console.log('Initializing Face Recognition Service in simulation mode...');
            
            // Set up demo authorized users
            this.authorizedUsers.add('user_001');
            this.authorizedUsers.add('user_002');
            
            // Start simulation mode
            if (this.simulationMode) {
                this.startSimulation();
            }
            
            this.isInitialized = true;
            console.log('Face Recognition Service initialized successfully');
            
            this.emit('initialized');
            
        } catch (error) {
            console.error('Failed to initialize Face Recognition Service:', error);
            throw error;
        }
    }
    
    startSimulation() {
        console.log('Starting face recognition simulation...');
        
        // Simulate face detection every 5 seconds
        this.simulationInterval = setInterval(() => {
            if (this.isMonitoring) {
                this.simulateFaceDetection();
            }
        }, 5000);
    }
    
    simulateFaceDetection() {
        // Randomly detect faces (80% chance)
        if (Math.random() > 0.2) {
            const randomUser = this.demoUsers[Math.floor(Math.random() * this.demoUsers.length)];
            this.handleUserRecognition(randomUser.id, randomUser.confidence);
        } else {
            this.handleNoFaceDetected();
        }
    }
    
    async startMonitoring() {
        if (!this.isInitialized) {
            throw new Error('Face Recognition Service not initialized');
        }
        
        this.isMonitoring = true;
        this.lastSeenTime = Date.now();
        
        console.log('Face monitoring started');
        this.emit('monitoring_started');
        
        // In simulation mode, monitoring is handled by the simulation interval
        if (!this.simulationMode) {
            // Start camera monitoring (would be implemented with actual camera access)
            this.startCameraMonitoring();
        }
    }
    
    async stopMonitoring() {
        this.isMonitoring = false;
        
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }
        
        if (this.cameraMonitoringInterval) {
            clearInterval(this.cameraMonitoringInterval);
        }
        
        console.log('Face monitoring stopped');
        this.emit('monitoring_stopped');
    }
    
    startCameraMonitoring() {
        // Placeholder for actual camera monitoring
        // This would be implemented with actual camera access libraries
        console.log('Camera monitoring would start here with actual camera access');
    }
    
    handleUserRecognition(userId, confidence) {
        if (confidence < this.recognitionThreshold) {
            this.handleFailedRecognition(userId);
            return;
        }
        
        if (this.authorizedUsers.has(userId)) {
            console.log(`Authorized user recognized: ${userId} (confidence: ${confidence})`);
            this.recognizedUsers.set(userId, {
                confidence: confidence,
                lastSeen: Date.now(),
                authorized: true
            });
            
            this.resetFailedAttempts(userId);
            this.emit('userRecognized', userId, confidence);
            
            // Update last seen time
            this.lastSeenTime = Date.now();
            
        } else {
            console.log(`Unauthorized user detected: ${userId} (confidence: ${confidence})`);
            this.handleFailedRecognition(userId);
        }
    }
    
    handleFailedRecognition(userId) {
        const attempts = this.failedAttempts.get(userId) || 0;
        this.failedAttempts.set(userId, attempts + 1);
        
        console.log(`Failed recognition for ${userId} (attempt ${attempts + 1})`);
        
        if (attempts + 1 >= this.maxFailedAttempts) {
            this.lockUser(userId);
        }
        
        this.emit('userNotRecognized', userId);
    }
    
    handleNoFaceDetected() {
        const timeSinceLastSeen = Date.now() - this.lastSeenTime;
        
        if (timeSinceLastSeen > this.absenceTimeout) {
            console.log('No face detected for extended period');
            this.emit('userAbsent');
        }
    }
    
    lockUser(userId) {
        const lockoutEnd = Date.now() + this.lockoutDuration;
        
        this.failedAttempts.set(userId, {
            count: this.maxFailedAttempts,
            lockoutEnd: lockoutEnd
        });
        
        console.log(`User ${userId} locked out for ${this.lockoutDuration / 1000} seconds`);
        this.emit('userLockedOut', userId, lockoutEnd);
    }
    
    resetFailedAttempts(userId) {
        this.failedAttempts.delete(userId);
    }
    
    isUserLockedOut(userId) {
        const attempts = this.failedAttempts.get(userId);
        if (!attempts || typeof attempts !== 'object') return false;
        
        const now = Date.now();
        const lockoutEnd = attempts.lockoutEnd;
        
        return lockoutEnd && now < lockoutEnd;
    }
    
    addAuthorizedUser(userId) {
        this.authorizedUsers.add(userId);
        console.log(`Added authorized user: ${userId}`);
        this.emit('userAuthorized', userId);
    }
    
    removeAuthorizedUser(userId) {
        this.authorizedUsers.delete(userId);
        this.recognizedUsers.delete(userId);
        console.log(`Removed authorized user: ${userId}`);
        this.emit('userUnauthorized', userId);
    }
    
    getRecognizedUsers() {
        const now = Date.now();
        const activeUsers = [];
        
        for (const [userId, userData] of this.recognizedUsers) {
            if (now - userData.lastSeen < this.absenceTimeout) {
                activeUsers.push({
                    userId: userId,
                    confidence: userData.confidence,
                    lastSeen: userData.lastSeen,
                    authorized: userData.authorized
                });
            }
        }
        
        return activeUsers;
    }
    
    getMonitoringStatus() {
        return {
            isMonitoring: this.isMonitoring,
            lastSeenTime: this.lastSeenTime,
            authorizedUsersCount: this.authorizedUsers.size,
            recognizedUsersCount: this.recognizedUsers.size,
            simulationMode: this.simulationMode,
            demoUsers: this.demoUsers.length
        };
    }
    
    getStatus() {
        return {
            active: true,
            monitoring: this.isMonitoring,
            simulationMode: this.simulationMode,
            authorizedUsers: this.authorizedUsers.size,
            recognizedUsers: this.recognizedUsers.size,
            lastRecognition: this.lastSeenTime
        };
    }
    
    destroy() {
        this.stopMonitoring();
        this.removeAllListeners();
        this.recognizedUsers.clear();
        this.authorizedUsers.clear();
        this.failedAttempts.clear();
    }
}

module.exports = { FaceRecognitionService };