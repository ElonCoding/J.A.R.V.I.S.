const { HolographicSpeechInterface } = require('./src/main');

// Test the holographic speech interface
async function testHolographicInterface() {
    console.log('🚀 Starting Holographic Speech Interface Test...\n');
    
    try {
        // Create interface instance
        const holographicInterface = new HolographicSpeechInterface();
        
        // Test service initialization
        console.log('📋 Testing Service Initialization...');
        await holographicInterface.initialize();
        console.log('✅ Services initialized successfully\n');
        
        // Test system status
        console.log('📊 Testing System Status...');
        const status = holographicInterface.getSystemStatus();
        console.log('System Status:', JSON.stringify(status, null, 2));
        console.log('✅ System status retrieved successfully\n');
        
        // Test speech recognition
        console.log('🎤 Testing Speech Recognition...');
        const speechStatus = holographicInterface.services.speechRecognition.getStatus();
        console.log('Speech Recognition Status:', speechStatus);
        console.log('✅ Speech recognition status retrieved\n');
        
        // Test text-to-speech
        console.log('🔊 Testing Text-to-Speech...');
        const ttsStatus = holographicInterface.services.textToSpeech.getStatus();
        console.log('Text-to-Speech Status:', ttsStatus);
        console.log('✅ Text-to-speech status retrieved\n');
        
        // Test holographic processor
        console.log('🌟 Testing Holographic Processor...');
        const holographicStatus = holographicInterface.services.holographic.getStatus();
        console.log('Holographic Status:', holographicStatus);
        console.log('✅ Holographic processor status retrieved\n');
        
        // Test noise cancellation
        console.log('🔧 Testing Noise Cancellation...');
        const noiseStatus = holographicInterface.services.noiseCancellation.getStatus();
        console.log('Noise Cancellation Status:', noiseStatus);
        console.log('✅ Noise cancellation status retrieved\n');
        
        // Test response generation
        console.log('💬 Testing Response Generation...');
        const testResponse = await holographicInterface.services.holographic.generateResponse(
            'Hello, how are you?',
            { userContext: { name: 'Test User', language: 'en-US' } }
        );
        console.log('Generated Response:', testResponse);
        console.log('✅ Response generated successfully\n');
        
        // Test multi-language support
        console.log('🌍 Testing Multi-Language Support...');
        const languages = ['en-US', 'es-ES', 'zh-CN'];
        for (const lang of languages) {
            const switched = holographicInterface.services.speechRecognition.switchLanguage(lang);
            console.log(`Language ${lang} switch: ${switched ? '✅' : '❌'}`);
        }
        console.log('✅ Multi-language support tested\n');
        
        // Test performance metrics
        console.log('⚡ Testing Performance Metrics...');
        const performance = holographicInterface.getPerformanceMetrics();
        console.log('Performance Metrics:', performance);
        console.log('✅ Performance metrics retrieved\n');
        
        // Test cleanup
        console.log('🧹 Testing Cleanup...');
        holographicInterface.cleanup();
        console.log('✅ Cleanup completed successfully\n');
        
        console.log('🎉 All tests completed successfully!');
        console.log('✨ Holographic Speech Interface is ready for use!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error('Stack:', error.stack);
    }
}

// Run the test
if (require.main === module) {
    testHolographicInterface();
}

module.exports = { testHolographicInterface };