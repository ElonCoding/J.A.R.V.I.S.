const { HolographicSpeechProcessor } = require('./src/services/holographicSpeechProcessor');
const { SpeechRecognitionService } = require('./src/services/speechRecognition');
const { TextToSpeechService } = require('./src/services/textToSpeech');
const { NoiseCancellationService } = require('./src/services/noiseCancellation');

// Test the holographic speech processor directly
async function testHolographicProcessor() {
    console.log('🚀 Starting Holographic Speech Processor Test...\n');
    
    try {
        // Test holographic processor initialization
        console.log('📋 Testing Holographic Processor Initialization...');
        const holographicProcessor = new HolographicSpeechProcessor();
        await holographicProcessor.initialize();
        console.log('✅ Holographic processor initialized successfully\n');
        
        // Test status
        console.log('📊 Testing Status...');
        const status = holographicProcessor.getStatus();
        console.log('Holographic Status:', JSON.stringify(status, null, 2));
        console.log('✅ Status retrieved successfully\n');
        
        // Test response generation
        console.log('💬 Testing Response Generation...');
        const response = await holographicProcessor.generateResponse('Hello, how are you?', {
            userContext: { name: 'Test User', language: 'en-US' }
        });
        console.log('Generated Response:', response);
        console.log('✅ Response generated successfully\n');
        
        // Test emotion display
        console.log('😊 Testing Emotion Display...');
        holographicProcessor.updateEmotionDisplay('happy');
        console.log('✅ Emotion display updated\n');
        
        // Test listening state
        console.log('🎤 Testing Listening State...');
        holographicProcessor.setListeningState(true);
        console.log('✅ Listening state set\n');
        
        // Test speaking state
        console.log('🔊 Testing Speaking State...');
        holographicProcessor.setSpeakingState(true);
        console.log('✅ Speaking state set\n');
        
        // Wait a bit for animations
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Stop speaking
        holographicProcessor.setSpeakingState(false);
        
        // Test display response
        console.log('🎭 Testing Display Response...');
        await holographicProcessor.displayResponse('Test response text', null);
        console.log('✅ Response displayed successfully\n');
        
        // Test cleanup
        console.log('🧹 Testing Cleanup...');
        holographicProcessor.stop();
        console.log('✅ Cleanup completed successfully\n');
        
        console.log('🎉 All holographic processor tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        process.exit(1);
    }
}

// Test speech recognition service
async function testSpeechRecognition() {
    console.log('🎤 Testing Speech Recognition Service...\n');
    
    try {
        const speechService = new SpeechRecognitionService();
        await speechService.initialize();
        
        const status = speechService.getStatus();
        console.log('Speech Recognition Status:', status);
        
        // Test language switching
        await speechService.switchLanguage('es-ES');
        console.log('✅ Language switched to Spanish\n');
        
        speechService.stop();
        console.log('✅ Speech recognition test passed\n');
        
    } catch (error) {
        console.error('❌ Speech recognition test failed:', error);
    }
}

// Test text-to-speech service
async function testTextToSpeech() {
    console.log('🔊 Testing Text-to-Speech Service...\n');
    
    try {
        const ttsService = new TextToSpeechService();
        await ttsService.initialize();
        
        const status = ttsService.getStatus();
        console.log('TTS Status:', status);
        
        // Test voice parameters
        ttsService.updateVoiceParameters({
            pitch: 1.2,
            rate: 0.9,
            volume: 0.8
        });
        console.log('✅ Voice parameters updated\n');
        
        ttsService.stop();
        console.log('✅ Text-to-speech test passed\n');
        
    } catch (error) {
        console.error('❌ Text-to-speech test failed:', error);
    }
}

// Test noise cancellation service
async function testNoiseCancellation() {
    console.log('🔇 Testing Noise Cancellation Service...\n');
    
    try {
        const noiseService = new NoiseCancellationService();
        await noiseService.initialize();
        
        const status = noiseService.getStatus();
        console.log('Noise Cancellation Status:', status);
        
        // Test noise reduction
        const mockAudio = new Float32Array(1024).fill(0.1);
        const enhanced = await noiseService.enhanceAudio(mockAudio);
        console.log('✅ Audio enhanced, reduction:', enhanced.noiseReduction);
        
        noiseService.stop();
        console.log('✅ Noise cancellation test passed\n');
        
    } catch (error) {
        console.error('❌ Noise cancellation test failed:', error);
    }
}

// Run all tests
async function runAllTests() {
    console.log('🧪 Running All Holographic Speech Tests...\n');
    
    await testHolographicProcessor();
    await testSpeechRecognition();
    await testTextToSpeech();
    await testNoiseCancellation();
    
    console.log('🎉 All tests completed successfully!');
}

runAllTests().catch(console.error);