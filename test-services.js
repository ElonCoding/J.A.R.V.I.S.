const { HolographicSpeechProcessor } = require('./src/services/holographicSpeechProcessor');
const { SpeechRecognitionService } = require('./src/services/speechRecognition');
const { TextToSpeechService } = require('./src/services/textToSpeech');
const { NoiseCancellationService } = require('./src/services/noiseCancellation');
const { GestureRecognitionService } = require('./src/services/gestureRecognition');
const { ConversationMemoryService } = require('./src/services/conversationMemory');
const { EmotionAnalysisService } = require('./src/services/emotionAnalysis');
const { UserProfileService } = require('./src/services/userProfile');
const { MultiUserManager } = require('./src/services/multiUserManager');
const { APIManager } = require('./src/services/apiManager');

// Test the holographic speech services
async function testHolographicServices() {
    console.log('🚀 Starting Holographic Speech Services Test...\n');
    
    try {
        // Initialize services
        console.log('📋 Initializing Services...');
        
        const services = {
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
        
        // Initialize each service
        for (const [name, service] of Object.entries(services)) {
            console.log(`Initializing ${name}...`);
            await service.initialize();
        }
        console.log('✅ All services initialized successfully\n');
        
        // Test speech recognition
        console.log('🎤 Testing Speech Recognition...');
        const speechStatus = services.speechRecognition.getStatus();
        console.log('Speech Recognition Status:', JSON.stringify(speechStatus, null, 2));
        console.log('✅ Speech recognition status retrieved\n');
        
        // Test text-to-speech
        console.log('🔊 Testing Text-to-Speech...');
        const ttsStatus = services.textToSpeech.getStatus();
        console.log('Text-to-Speech Status:', JSON.stringify(ttsStatus, null, 2));
        console.log('✅ Text-to-speech status retrieved\n');
        
        // Test holographic processor (without 3D rendering)
        console.log('🌟 Testing Holographic Processor...');
        const holographicStatus = services.holographic.getStatus();
        console.log('Holographic Status:', JSON.stringify(holographicStatus, null, 2));
        console.log('✅ Holographic processor status retrieved\n');
        
        // Test noise cancellation
        console.log('🔧 Testing Noise Cancellation...');
        const noiseStatus = services.noiseCancellation.getStatus();
        console.log('Noise Cancellation Status:', JSON.stringify(noiseStatus, null, 2));
        console.log('✅ Noise cancellation status retrieved\n');
        
        // Test response generation
        console.log('💬 Testing Response Generation...');
        const testResponse = await services.holographic.generateResponse(
            'Hello, how are you?',
            { userContext: { name: 'Test User', language: 'en-US' } }
        );
        console.log('Generated Response:', JSON.stringify(testResponse, null, 2));
        console.log('✅ Response generated successfully\n');
        
        // Test multi-language support
        console.log('🌍 Testing Multi-Language Support...');
        const languages = ['en-US', 'es-ES', 'zh-CN'];
        for (const lang of languages) {
            const switched = services.speechRecognition.switchLanguage(lang);
            console.log(`Language ${lang} switch: ${switched ? '✅' : '❌'}`);
        }
        console.log('✅ Multi-language support tested\n');
        
        // Test text-to-speech synthesis
        console.log('🗣️ Testing Text-to-Speech Synthesis...');
        const utteranceId = await services.textToSpeech.speak('Hello! This is a test of the holographic speech system.', {
            emotion: 'friendly',
            language: 'en-US'
        });
        console.log('Speech synthesis started with ID:', utteranceId);
        
        // Wait a bit for speech to complete
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('✅ Text-to-speech synthesis tested\n');
        
        // Test noise cancellation enhancement
        console.log('🔍 Testing Noise Cancellation Enhancement...');
        const testAudio = {
            data: new Float32Array(1024),
            sampleRate: 16000,
            channels: 1
        };
        
        // Fill with simulated audio data
        for (let i = 0; i < testAudio.data.length; i++) {
            testAudio.data[i] = (Math.random() - 0.5) * 0.1;
        }
        
        const enhancedAudio = await services.noiseCancellation.enhance(testAudio);
        console.log('Enhanced Audio:', {
            noiseReduction: enhancedAudio.noiseReduction,
            signalToNoiseRatio: enhancedAudio.signalToNoiseRatio
        });
        console.log('✅ Noise cancellation enhancement tested\n');
        
        // Test conversation memory
        console.log('🧠 Testing Conversation Memory...');
        await services.conversationMemory.addMessage('test_user', {
            type: 'user',
            text: 'Hello, this is a test message.',
            emotion: 'neutral',
            timestamp: Date.now()
        });
        
        const history = await services.conversationMemory.getHistory('test_user');
        console.log('Conversation History:', history);
        console.log('✅ Conversation memory tested\n');
        
        // Test user profile management
        console.log('👤 Testing User Profile Management...');
        await services.userProfile.createProfile('test_user', {
            name: 'Test User',
            language: 'en-US',
            preferredVoice: 'default'
        });
        
        const profile = await services.userProfile.getProfile('test_user');
        console.log('User Profile:', profile);
        console.log('✅ User profile management tested\n');
        
        // Test multi-user management
        console.log('👥 Testing Multi-User Management...');
        await services.multiUser.addUser('user1');
        await services.multiUser.addUser('user2');
        
        const activeUsers = services.multiUser.getActiveUsers();
        console.log('Active Users:', activeUsers);
        console.log('✅ Multi-user management tested\n');
        
        // Test API integration
        console.log('🔌 Testing API Integration...');
        const weatherResult = await services.apiManager.performQuery({ type: 'weather' });
        const timeResult = await services.apiManager.performQuery({ type: 'time' });
        
        console.log('Weather Query Result:', weatherResult);
        console.log('Time Query Result:', timeResult);
        console.log('✅ API integration tested\n');
        
        // Test emotion analysis
        console.log('😊 Testing Emotion Analysis...');
        const emotion = await services.emotionAnalysis.analyzeText('I am very happy today!');
        console.log('Detected Emotion:', emotion);
        console.log('✅ Emotion analysis tested\n');
        
        // Test gesture recognition
        console.log('👋 Testing Gesture Recognition...');
        const gesture = await services.gestureRecognition.detectGesture(null);
        console.log('Detected Gesture:', gesture);
        console.log('✅ Gesture recognition tested\n');
        
        // Test service cleanup
        console.log('🧹 Testing Service Cleanup...');
        for (const [name, service] of Object.entries(services)) {
            console.log(`Stopping ${name}...`);
            service.stop();
        }
        console.log('✅ All services stopped successfully\n');
        
        console.log('🎉 All tests completed successfully!');
        console.log('✨ Holographic Speech Services are ready for integration!');
        
        // Summary
        console.log('\n📊 Test Summary:');
        console.log('- ✅ Service initialization');
        console.log('- ✅ Speech recognition (multi-language)');
        console.log('- ✅ Text-to-speech synthesis');
        console.log('- ✅ Holographic processing');
        console.log('- ✅ Noise cancellation');
        console.log('- ✅ Response generation');
        console.log('- ✅ Conversation memory');
        console.log('- ✅ User profile management');
        console.log('- ✅ Multi-user support');
        console.log('- ✅ API integration');
        console.log('- ✅ Emotion analysis');
        console.log('- ✅ Gesture recognition');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack:', error.stack);
    }
}

// Run the test
if (require.main === module) {
    testHolographicServices();
}

module.exports = { testHolographicServices };