const EventEmitter = require('events');

class EmotionDetectionService extends EventEmitter {
    constructor() {
        super();
        this.currentEmotion = { type: 'neutral', intensity: 0.5, confidence: 0.8 };
        this.emotionHistory = [];
        this.voicePatterns = new Map();
        this.facialExpressions = new Map();
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.simulationMode = true; // Enable simulation for demo
        
        // Emotion thresholds and patterns
        this.emotionThresholds = {
            calm: { volume: [20, 80], pitch: [80, 150], speechRate: [0.8, 1.2] },
            stressed: { volume: [100, 200], pitch: [150, 250], speechRate: [1.3, 2.0] },
            angry: { volume: [120, 255], pitch: [180, 300], speechRate: [1.0, 1.8] },
            excited: { volume: [80, 150], pitch: [120, 200], speechRate: [1.2, 1.8] },
            fatigued: { volume: [10, 60], pitch: [60, 120], speechRate: [0.5, 0.9] },
            sad: { volume: [15, 70], pitch: [70, 130], speechRate: [0.6, 1.0] }
        };
        
        // Demo emotion data for simulation
        this.demoEmotions = ['calm', 'stressed', 'excited', 'neutral', 'fatigued'];
    }

    async initialize() {
        try {
            console.log('Initializing Emotion Detection Service in simulation mode...');
            
            // Note: In Electron, audio context is only available in the renderer process
            // For now, we'll use simulation mode in the main process
            if (this.simulationMode) {
                this.setupSimulation();
            }
            
            console.log('Emotion detection service initialized');
            this.emit('initialized');
            
        } catch (error) {
            console.error('Failed to initialize emotion detection:', error);
            throw error;
        }
    }

    setupSimulation() {
        console.log('Setting up emotion detection simulation...');
        
        // Simulate emotion changes every 15-45 seconds
        this.simulationInterval = setInterval(() => {
            if (this.isMonitoring && Math.random() > 0.6) {
                this.simulateEmotionChange();
            }
        }, 15000 + Math.random() * 30000);
    }

    simulateEmotionChange() {
        const randomEmotion = this.demoEmotions[Math.floor(Math.random() * this.demoEmotions.length)];
        const intensity = 0.4 + Math.random() * 0.6; // 0.4 to 1.0
        const confidence = 0.6 + Math.random() * 0.4; // 0.6 to 1.0
        
        this.updateEmotion(randomEmotion, intensity, confidence, 'simulated');
        console.log(`Simulated emotion change: ${randomEmotion} (intensity: ${intensity.toFixed(2)})`);
    }

    startMonitoring() {
        this.isMonitoring = true;
        console.log('Emotion monitoring started');
        this.emit('monitoring_started');
    }

    stopMonitoring() {
        this.isMonitoring = false;
        
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }
        
        console.log('Emotion monitoring stopped');
        this.emit('monitoring_stopped');
    }

    analyzeVoiceEmotion(voiceData) {
        try {
            // In a real implementation, this would analyze audio characteristics
            // For simulation, we'll use the voice data to influence emotion detection
            const { volume, pitch, speechRate } = voiceData;
            
            // Simulate emotion based on voice characteristics
            let detectedEmotion = 'neutral';
            let confidence = 0.7;
            
            if (volume > 150) {
                detectedEmotion = Math.random() > 0.5 ? 'angry' : 'excited';
                confidence = 0.8;
            } else if (volume < 30) {
                detectedEmotion = 'fatigued';
                confidence = 0.6;
            } else if (pitch > 200) {
                detectedEmotion = 'stressed';
                confidence = 0.75;
            } else if (speechRate > 1.5) {
                detectedEmotion = 'excited';
                confidence = 0.8;
            } else if (speechRate < 0.8) {
                detectedEmotion = 'fatigued';
                confidence = 0.7;
            }
            
            const intensity = 0.5 + Math.random() * 0.5;
            this.updateEmotion(detectedEmotion, intensity, confidence, 'voice');
            
            return {
                emotion: detectedEmotion,
                intensity: intensity,
                confidence: confidence,
                source: 'voice'
            };
            
        } catch (error) {
            console.error('Error analyzing voice emotion:', error);
            return null;
        }
    }

    analyzeFacialEmotion(facialData) {
        try {
            // In a real implementation, this would analyze facial expressions
            // For simulation, we'll use the facial data to influence emotion detection
            const { expressions, landmarks } = facialData;
            
            // Simulate emotion based on facial characteristics
            let detectedEmotion = 'neutral';
            let confidence = 0.6;
            
            if (expressions && expressions.happy > 0.7) {
                detectedEmotion = 'excited';
                confidence = expressions.happy;
            } else if (expressions && expressions.sad > 0.6) {
                detectedEmotion = 'sad';
                confidence = expressions.sad;
            } else if (expressions && expressions.angry > 0.6) {
                detectedEmotion = 'angry';
                confidence = expressions.angry;
            } else if (expressions && expressions.surprised > 0.7) {
                detectedEmotion = 'excited';
                confidence = expressions.surprised;
            }
            
            const intensity = confidence;
            this.updateEmotion(detectedEmotion, intensity, confidence, 'facial');
            
            return {
                emotion: detectedEmotion,
                intensity: intensity,
                confidence: confidence,
                source: 'facial'
            };
            
        } catch (error) {
            console.error('Error analyzing facial emotion:', error);
            return null;
        }
    }

    updateEmotion(emotion, intensity, confidence, source) {
        const previousEmotion = { ...this.currentEmotion };
        
        this.currentEmotion = {
            type: emotion,
            intensity: intensity,
            confidence: confidence,
            timestamp: Date.now(),
            source: source
        };
        
        // Add to history
        this.emotionHistory.push(this.currentEmotion);
        
        // Keep history limited to last 100 entries
        if (this.emotionHistory.length > 100) {
            this.emotionHistory.shift();
        }
        
        // Emit emotion change event
        if (previousEmotion.type !== emotion || 
            Math.abs(previousEmotion.intensity - intensity) > 0.3) {
            this.emit('emotion_changed', this.currentEmotion, previousEmotion);
        }
        
        this.emit('emotion_detected', this.currentEmotion);
    }

    getCurrentEmotion() {
        return { ...this.currentEmotion };
    }

    getEmotionHistory(duration = null) {
        if (!duration) {
            return [...this.emotionHistory];
        }
        
        const cutoffTime = Date.now() - duration;
        return this.emotionHistory.filter(entry => entry.timestamp >= cutoffTime);
    }

    getEmotionStatistics(duration = 60000) { // Last minute by default
        const recentHistory = this.getEmotionHistory(duration);
        
        if (recentHistory.length === 0) {
            return {
                dominantEmotion: 'neutral',
                emotionCounts: {},
                averageIntensity: 0.5,
                averageConfidence: 0.7
            };
        }
        
        const emotionCounts = {};
        let totalIntensity = 0;
        let totalConfidence = 0;
        
        recentHistory.forEach(entry => {
            emotionCounts[entry.type] = (emotionCounts[entry.type] || 0) + 1;
            totalIntensity += entry.intensity;
            totalConfidence += entry.confidence;
        });
        
        const dominantEmotion = Object.keys(emotionCounts).reduce((a, b) => 
            emotionCounts[a] > emotionCounts[b] ? a : b, 'neutral');
        
        return {
            dominantEmotion: dominantEmotion,
            emotionCounts: emotionCounts,
            averageIntensity: totalIntensity / recentHistory.length,
            averageConfidence: totalConfidence / recentHistory.length,
            sampleCount: recentHistory.length
        };
    }

    getEmotionTrend(duration = 300000) { // Last 5 minutes
        const history = this.getEmotionHistory(duration);
        
        if (history.length < 2) {
            return { trend: 'stable', confidence: 0.5 };
        }
        
        const recent = history.slice(-10); // Last 10 entries
        const earlier = history.slice(0, 10); // First 10 entries
        
        const recentEmotions = recent.map(e => e.type);
        const earlierEmotions = earlier.map(e => e.type);
        
        // Simple trend analysis
        const positiveEmotions = ['excited', 'happy'];
        const negativeEmotions = ['angry', 'stressed', 'sad'];
        
        const recentPositive = recentEmotions.filter(e => positiveEmotions.includes(e)).length;
        const recentNegative = recentEmotions.filter(e => negativeEmotions.includes(e)).length;
        const earlierPositive = earlierEmotions.filter(e => positiveEmotions.includes(e)).length;
        const earlierNegative = earlierEmotions.filter(e => negativeEmotions.includes(e)).length;
        
        if (recentPositive > earlierPositive) {
            return { trend: 'improving', confidence: 0.7 };
        } else if (recentNegative > earlierNegative) {
            return { trend: 'declining', confidence: 0.7 };
        } else {
            return { trend: 'stable', confidence: 0.8 };
        }
    }
    
    getStatus() {
        return {
            active: true,
            monitoring: this.isMonitoring,
            simulationMode: this.simulationMode,
            currentEmotion: this.currentEmotion,
            emotionHistory: this.emotionHistory.length,
            voicePatterns: this.voicePatterns.size,
            facialExpressions: this.facialExpressions.size
        };
    }

    destroy() {
        this.stopMonitoring();
        
        if (this.simulationInterval) {
            clearInterval(this.simulationInterval);
        }
        
        this.emotionHistory = [];
        this.voicePatterns.clear();
        this.facialExpressions.clear();
        this.removeAllListeners();
    }
}

module.exports = { EmotionDetectionService };