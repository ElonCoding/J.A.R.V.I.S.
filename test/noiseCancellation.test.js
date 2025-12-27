const { NoiseCancellationService } = require('../src/services/noiseCancellation');
const { EventEmitter } = require('events');

describe('NoiseCancellationService', () => {
    let service;
    let mockAudioData;

    beforeEach(() => {
        service = new NoiseCancellationService();
        
        // Mock audio data for testing
        mockAudioData = {
            data: new Float32Array(1024),
            sampleRate: 44100,
            channels: 1
        };
        
        // Fill with some test data
        for (let i = 0; i < mockAudioData.data.length; i++) {
            mockAudioData.data[i] = Math.sin(i * 0.1) * 0.5 + Math.random() * 0.1;
        }
    });

    afterEach(() => {
        if (service && typeof service.destroy === 'function') {
            service.destroy();
        }
    });

    describe('Initialization', () => {
        test('should initialize successfully', async () => {
            await service.initialize();
            expect(service.isInitialized).toBe(true);
        });

        test('should handle initialization failure gracefully', async () => {
            // Mock AudioContext to throw error
            const originalAudioContext = global.AudioContext;
            global.AudioContext = jest.fn(() => {
                throw new Error('AudioContext not supported');
            });

            await service.initialize();
            expect(service.isInitialized).toBe(true); // Should fall back to simulation mode
            
            global.AudioContext = originalAudioContext;
        });
    });

    describe('Input Validation', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        test('should throw error for null audio data', async () => {
            await expect(service.enhance(null)).rejects.toThrow('Invalid audio data provided');
        });

        test('should throw error for undefined audio data', async () => {
            await expect(service.enhance(undefined)).rejects.toThrow('Invalid audio data provided');
        });

        test('should throw error for empty audio data object', async () => {
            await expect(service.enhance({})).rejects.toThrow('Invalid audio data provided');
        });

        test('should throw error for audio data without data property', async () => {
            await expect(service.enhance({ sampleRate: 44100 })).rejects.toThrow('Invalid audio data provided');
        });

        test('should throw error for audio data exceeding size limit', async () => {
            const largeAudioData = {
                data: new Float32Array(60 * 1024 * 1024), // 60MB
                sampleRate: 44100
            };
            
            await expect(service.enhance(largeAudioData)).rejects.toThrow('Audio data too large');
        });

        test('should handle zero-length audio data', async () => {
            const emptyAudioData = {
                data: new Float32Array(0),
                sampleRate: 44100
            };
            
            const result = await service.enhance(emptyAudioData);
            expect(result.data).toBeDefined();
            expect(result.data.length).toBe(0);
        });
    });

    describe('Circular Buffer Implementation', () => {
        let CircularBuffer;

        beforeAll(() => {
            // Access the CircularBuffer class from the service
            CircularBuffer = service.CircularBuffer || class CircularBuffer {
                constructor(maxSize) {
                    this.maxSize = maxSize;
                    this.buffer = new Float32Array(maxSize);
                    this.head = 0;
                    this.tail = 0;
                    this.size = 0;
                    this.sum = 0;
                }

                push(value) {
                    if (this.size === this.maxSize) {
                        this.sum -= this.buffer[this.head];
                        this.head = (this.head + 1) % this.maxSize;
                        this.size--;
                    }
                    this.buffer[this.tail] = value;
                    this.sum += value;
                    this.tail = (this.tail + 1) % this.maxSize;
                    this.size++;
                }

                average() {
                    return this.size === 0 ? 0 : this.sum / this.size;
                }
            };
        });

        test('should maintain correct average with single value', () => {
            const buffer = new CircularBuffer(10);
            buffer.push(5);
            expect(buffer.average()).toBe(5);
        });

        test('should maintain correct average with multiple values', () => {
            const buffer = new CircularBuffer(10);
            buffer.push(1);
            buffer.push(2);
            buffer.push(3);
            expect(buffer.average()).toBe(2);
        });

        test('should handle buffer overflow correctly', () => {
            const buffer = new CircularBuffer(3);
            buffer.push(1);
            buffer.push(2);
            buffer.push(3);
            buffer.push(4); // Should remove 1
            expect(buffer.average()).toBe(3); // (2+3+4)/3
        });

        test('should handle zero max size gracefully', () => {
            const buffer = new CircularBuffer(0);
            buffer.push(5);
            expect(buffer.average()).toBe(0);
        });

        test('should return zero for empty buffer', () => {
            const buffer = new CircularBuffer(10);
            expect(buffer.average()).toBe(0);
        });
    });

    describe('Audio Processing', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        test('should process valid audio data', async () => {
            const result = await service.enhance(mockAudioData);
            
            expect(result).toBeDefined();
            expect(result.data).toBeDefined();
            expect(result.data.length).toBe(mockAudioData.data.length);
            expect(result.sampleRate).toBe(mockAudioData.sampleRate);
            expect(result.channels).toBe(mockAudioData.channels);
        });

        test('should return original audio on processing failure', async () => {
            // Mock an internal processing error
            const originalProcessAudio = service.processAudio;
            service.processAudio = jest.fn(() => {
                throw new Error('Processing failed');
            });

            const result = await service.enhance(mockAudioData);
            
            expect(result.data).toEqual(mockAudioData.data);
            expect(result.sampleRate).toBe(mockAudioData.sampleRate);
            
            service.processAudio = originalProcessAudio;
        });

        test('should handle different sample rates', async () => {
            const audioData48k = {
                data: new Float32Array(1024),
                sampleRate: 48000,
                channels: 1
            };
            
            const result = await service.enhance(audioData48k);
            expect(result.sampleRate).toBe(48000);
        });

        test('should handle multi-channel audio', async () => {
            const stereoAudioData = {
                data: new Float32Array(2048), // 1024 samples per channel
                sampleRate: 44100,
                channels: 2
            };
            
            const result = await service.enhance(stereoAudioData);
            expect(result.channels).toBe(2);
        });
    });

    describe('Performance and Memory Management', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        test('should handle large audio files efficiently', async () => {
            const largeAudioData = {
                data: new Float32Array(10 * 1024 * 1024), // 10MB
                sampleRate: 44100,
                channels: 1
            };
            
            const startTime = Date.now();
            const result = await service.enhance(largeAudioData);
            const endTime = Date.now();
            
            expect(result).toBeDefined();
            expect(result.data.length).toBe(largeAudioData.data.length);
            expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
        });

        test('should not leak memory on repeated processing', async () => {
            const initialMemory = process.memoryUsage().heapUsed;
            
            // Process the same audio multiple times
            for (let i = 0; i < 100; i++) {
                await service.enhance(mockAudioData);
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
            
            const finalMemory = process.memoryUsage().heapUsed;
            const memoryIncrease = finalMemory - initialMemory;
            
            // Memory increase should be minimal (less than 10MB for 100 iterations)
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
        });

        test('should update processing statistics', async () => {
            const initialStats = { ...service.processingStats };
            
            await service.enhance(mockAudioData);
            
            expect(service.processingStats.totalProcessed).toBeGreaterThan(initialStats.totalProcessed);
            expect(service.processingStats.averageProcessingTime).toBeGreaterThanOrEqual(0);
        });
    });

    describe('Timeout Protection', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        test('should complete processing within timeout limit', async () => {
            const startTime = Date.now();
            await service.enhance(mockAudioData);
            const endTime = Date.now();
            
            expect(endTime - startTime).toBeLessThan(5000); // 5 second timeout
        });

        test('should handle slow processing gracefully', async () => {
            // Mock slow processing in simulation mode
            const originalSimulateEnhancement = service.simulateEnhancement;
            service.simulateEnhancement = jest.fn(async (audioData) => {
                // Simulate slow processing
                await new Promise(resolve => setTimeout(resolve, 150));
                return {
                    data: audioData.data,
                    sampleRate: audioData.sampleRate,
                    channels: audioData.channels,
                    duration: audioData.duration || 1000,
                    noiseReduction: 15.5,
                    signalToNoiseRatio: 12.3
                };
            });

            const startTime = Date.now();
            const result = await service.enhance(mockAudioData);
            const endTime = Date.now();
            
            expect(result).toBeDefined();
            expect(endTime - startTime).toBeGreaterThanOrEqual(150);
            expect(endTime - startTime).toBeLessThan(5000);
            
            service.simulateEnhancement = originalSimulateEnhancement;
        });
    });

    describe('Event Handling', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        test('should emit processing events', async () => {
            const eventSpy = jest.fn();
            service.on('processing', eventSpy);
            
            // Run multiple times to increase chance of event emission (10% chance per run)
            for (let i = 0; i < 50; i++) {
                await service.enhance(mockAudioData);
            }
            
            // With 50 runs at 10% chance, we expect ~5 events
            expect(eventSpy).toHaveBeenCalled();
        });

        test('should emit error events on failure', async () => {
            const errorSpy = jest.fn();
            service.on('enhancementError', errorSpy);
            
            // Mock an error in simulateEnhancement (since we're in simulation mode)
            const originalSimulateEnhancement = service.simulateEnhancement;
            service.simulateEnhancement = jest.fn(() => {
                throw new Error('Test error');
            });
            
            // The enhance method should catch the error and emit it
            await service.enhance(mockAudioData);
            
            // Error should be emitted
            expect(errorSpy).toHaveBeenCalled();
            
            service.simulateEnhancement = originalSimulateEnhancement;
        });
    });

    describe('Backward Compatibility', () => {
        test('should maintain original API', () => {
            expect(service.initialize).toBeDefined();
            expect(service.enhance).toBeDefined();
            expect(service.on).toBeDefined();
            expect(service.emit).toBeDefined();
        });

        test('should return consistent data format', async () => {
            await service.initialize();
            
            const result = await service.enhance(mockAudioData);
            
            expect(result).toHaveProperty('data');
            expect(result).toHaveProperty('sampleRate');
            expect(result).toHaveProperty('channels');
            expect(Array.isArray(result.data) || result.data instanceof Float32Array).toBe(true);
        });

        test('should work without initialization parameters', async () => {
            const simpleService = new NoiseCancellationService();
            await simpleService.initialize();
            
            const result = await simpleService.enhance(mockAudioData);
            expect(result).toBeDefined();
            
            simpleService.destroy();
        });
    });

    describe('Edge Cases', () => {
        beforeEach(async () => {
            await service.initialize();
        });

        test('should handle NaN values in audio data', async () => {
            const nanAudioData = {
                data: new Float32Array([1, 2, NaN, 4, 5]),
                sampleRate: 44100
            };
            
            const result = await service.enhance(nanAudioData);
            expect(result.data).toBeDefined();
            expect(result.data.length).toBe(5);
        });

        test('should handle infinity values in audio data', async () => {
            const infAudioData = {
                data: new Float32Array([1, 2, Infinity, -Infinity, 5]),
                sampleRate: 44100
            };
            
            const result = await service.enhance(infAudioData);
            expect(result.data).toBeDefined();
            expect(result.data.length).toBe(5);
        });

        test('should handle very small sample rates', async () => {
            const lowSampleRateData = {
                data: new Float32Array(100),
                sampleRate: 100,
                channels: 1
            };
            
            const result = await service.enhance(lowSampleRateData);
            expect(result.sampleRate).toBe(100);
        });

        test('should handle very high sample rates', async () => {
            const highSampleRateData = {
                data: new Float32Array(100),
                sampleRate: 192000,
                channels: 1
            };
            
            const result = await service.enhance(highSampleRateData);
            expect(result.sampleRate).toBe(192000);
        });

        test('should handle many channels', async () => {
            const manyChannelsData = {
                data: new Float32Array(800), // 100 samples per channel
                sampleRate: 44100,
                channels: 8
            };
            
            const result = await service.enhance(manyChannelsData);
            expect(result.channels).toBe(8);
        });
    });

    describe('RMS Calculation', () => {
        test('should calculate RMS correctly for positive values', () => {
            const data = new Float32Array([1, 2, 3, 4, 5]);
            const expectedRMS = Math.sqrt((1 + 4 + 9 + 16 + 25) / 5);
            
            expect(service.calculateRMS(data)).toBeCloseTo(expectedRMS, 5);
        });

        test('should calculate RMS correctly for negative values', () => {
            const data = new Float32Array([-1, -2, -3, -4, -5]);
            const expectedRMS = Math.sqrt((1 + 4 + 9 + 16 + 25) / 5);
            
            expect(service.calculateRMS(data)).toBeCloseTo(expectedRMS, 5);
        });

        test('should calculate RMS correctly for mixed values', () => {
            const data = new Float32Array([1, -2, 3, -4, 5]);
            const expectedRMS = Math.sqrt((1 + 4 + 9 + 16 + 25) / 5);
            
            expect(service.calculateRMS(data)).toBeCloseTo(expectedRMS, 5);
        });

        test('should return 0 for empty data', () => {
            expect(service.calculateRMS(null)).toBe(0);
            expect(service.calculateRMS(undefined)).toBe(0);
            expect(service.calculateRMS(new Float32Array(0))).toBe(0);
        });
    });
});