// Test setup file
// Enable garbage collection for memory tests
if (global.gc) {
  global.gc();
}

// Mock AudioContext for Node.js environment
class MockAudioContext {
  constructor() {
    this.sampleRate = 44100;
    this.state = 'running';
    this.currentTime = 0;
  }
  
  createScriptProcessor(bufferSize, inputChannels, outputChannels) {
    return {
      bufferSize,
      inputChannels,
      outputChannels,
      onaudioprocess: null,
      connect: jest.fn(),
      disconnect: jest.fn()
    };
  }
  
  createBuffer(channels, length, sampleRate) {
    return {
      channels,
      length,
      sampleRate,
      getChannelData: jest.fn(() => new Float32Array(length))
    };
  }
  
  createBufferSource() {
    return {
      buffer: null,
      connect: jest.fn(),
      disconnect: jest.fn(),
      start: jest.fn(),
      stop: jest.fn()
    };
  }
  
  destination = {
    channelCount: 2,
    channelCountMode: 'explicit',
    channelInterpretation: 'speakers'
  };
  
  close() {
    this.state = 'closed';
    return Promise.resolve();
  }
}

// Set up global AudioContext mock
global.AudioContext = MockAudioContext;
global.webkitAudioContext = MockAudioContext;

// Mock performance.now for timing tests
global.performance = {
  now: jest.fn(() => Date.now())
};

// Suppress console output during tests unless explicitly testing logging
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

beforeEach(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterEach(() => {
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});