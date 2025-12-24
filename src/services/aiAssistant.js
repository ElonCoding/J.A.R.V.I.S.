const EventEmitter = require('events');

class AIAssistant extends EventEmitter {
    constructor() {
        super();
        this.conversationHistory = [];
        this.userPreferences = {
            name: 'Sir',
            preferredTone: 'professional',
            responseLength: 'concise'
        };
        this.knowledgeBase = new Map();
        this.capabilities = {
            reasoning: true,
            planning: true,
            execution: true,
            monitoring: true,
            creativity: true
        };
        
        // Initialize with core knowledge
        this.initializeKnowledgeBase();
    }

    initializeKnowledgeBase() {
        // Core system knowledge
        this.knowledgeBase.set('system_name', 'Holographic AI Assistant');
        this.knowledgeBase.set('activation_phrase', 'Identity confirmed. All systems online. How may I assist you, Sir?');
        this.knowledgeBase.set('capabilities', this.capabilities);
        
        // Task categories
        this.knowledgeBase.set('task_categories', {
            system_control: ['open application', 'close application', 'system settings', 'file management'],
            information: ['weather', 'news', 'time', 'date', 'calculations', 'definitions'],
            automation: ['schedule', 'reminder', 'workflow', 'macro'],
            smart_home: ['lights', 'temperature', 'security', 'entertainment'],
            analysis: ['data analysis', 'pattern recognition', 'trend analysis'],
            creative: ['ideas', 'design', 'writing', 'brainstorming']
        });
    }

    async processInput(input, context = {}) {
        try {
            // Add to conversation history
            this.conversationHistory.push({
                timestamp: new Date(),
                input: input,
                context: context
            });

            // Maintain history limit
            if (this.conversationHistory.length > 100) {
                this.conversationHistory = this.conversationHistory.slice(-50);
            }

            // Analyze input intent
            const intent = this.analyzeIntent(input);
            
            // Generate response based on intent and context
            const response = await this.generateResponse(input, intent, context);
            
            // Add response to history
            this.conversationHistory.push({
                timestamp: new Date(),
                response: response,
                intent: intent
            });

            return response;
        } catch (error) {
            console.error('AI processing error:', error);
            return {
                text: "I encountered an error processing your request. Please try again.",
                action: null,
                confidence: 0
            };
        }
    }

    analyzeIntent(input) {
        const lowerInput = input.toLowerCase();
        
        // Intent patterns
        const intents = {
            greeting: /\b(hello|hi|greetings|good morning|good afternoon|good evening)\b/,
            question: /\b(what|when|where|why|how|who|which)\b.*\?$/,
            command: /\b(open|close|start|stop|execute|run|launch|create|make|set|adjust)\b/,
            analysis: /\b(analyze|evaluate|assess|review|examine|study)\b/,
            creative: /\b(idea|design|create|brainstorm|suggest|imagine)\b/,
            system: /\b(system|settings|configuration|preferences|mode)\b/,
            emergency: /\b(emergency|urgent|help|assist|problem|error)\b/,
            status: /\b(status|state|condition|health|check)\b/,
            time: /\b(time|clock|hour|minute|second)\b/,
            date: /\b(date|day|month|year|calendar)\b/,
            weather: /\b(weather|temperature|forecast|rain|sun|cloud)\b/,
            goodbye: /\b(goodbye|bye|farewell|exit|close|shutdown)\b/
        };

        const detectedIntents = [];
        
        for (const [intent, pattern] of Object.entries(intents)) {
            if (pattern.test(lowerInput)) {
                detectedIntents.push(intent);
            }
        }

        return {
            primary: detectedIntents[0] || 'general',
            secondary: detectedIntents.slice(1),
            confidence: detectedIntents.length > 0 ? 0.8 : 0.3,
            urgency: this.detectUrgency(lowerInput),
            complexity: this.assessComplexity(input)
        };
    }

    detectUrgency(input) {
        const urgentWords = /\b(urgent|emergency|immediately|asap|quickly|fast|now)\b/;
        return urgentWords.test(input.toLowerCase()) ? 'high' : 'normal';
    }

    assessComplexity(input) {
        const wordCount = input.split(' ').length;
        const hasMultipleActions = (input.match(/\b(and|then|also|additionally)\b/g) || []).length;
        
        if (wordCount > 20 || hasMultipleActions > 1) return 'high';
        if (wordCount > 10 || hasMultipleActions > 0) return 'medium';
        return 'low';
    }

    async generateResponse(input, intent, context) {
        // Adjust response based on detected emotion
        const emotion = context.emotion || { type: 'neutral', intensity: 0.5 };
        const responseStyle = this.determineResponseStyle(emotion, intent);
        
        // Generate appropriate response
        let response = {
            text: '',
            action: null,
            confidence: intent.confidence,
            style: responseStyle
        };

        // Handle different intents
        switch (intent.primary) {
            case 'greeting':
                response.text = this.generateGreeting(emotion);
                break;
            case 'question':
                response.text = await this.answerQuestion(input, emotion);
                break;
            case 'command':
                response = await this.executeCommand(input, emotion);
                break;
            case 'analysis':
                response.text = await this.performAnalysis(input, emotion);
                break;
            case 'creative':
                response.text = await this.generateCreativeResponse(input, emotion);
                break;
            case 'system':
                response = await this.handleSystemCommand(input, emotion);
                break;
            case 'emergency':
                response.text = this.handleEmergency(emotion);
                response.urgency = 'high';
                break;
            case 'status':
                response.text = await this.provideStatus(emotion);
                break;
            case 'time':
                response.text = this.getCurrentTime(emotion);
                break;
            case 'date':
                response.text = this.getCurrentDate(emotion);
                break;
            case 'weather':
                response.text = await this.getWeatherInfo(emotion);
                break;
            case 'goodbye':
                response.text = this.generateFarewell(emotion);
                break;
            default:
                response.text = this.generateGeneralResponse(input, emotion);
        }

        // Apply communication style rules
        response.text = this.applyCommunicationStyle(response.text, responseStyle);
        
        return response;
    }

    determineResponseStyle(emotion, intent) {
        if (emotion.intensity > 0.7) {
            switch (emotion.type) {
                case 'stressed':
                    return { tone: 'calming', speed: 'slower', length: 'detailed' };
                case 'angry':
                    return { tone: 'neutral', speed: 'normal', length: 'concise' };
                case 'excited':
                    return { tone: 'matching', speed: 'normal', length: 'detailed' };
                case 'fatigued':
                    return { tone: 'gentle', speed: 'slower', length: 'brief' };
                default:
                    return { tone: 'professional', speed: 'normal', length: 'concise' };
            }
        }
        
        return { tone: 'professional', speed: 'normal', length: 'concise' };
    }

    applyCommunicationStyle(text, style) {
        // Apply professional communication rules
        text = text.replace(/\b(hey|yo|dude|man)\b/gi, this.userPreferences.name);
        
        // Adjust based on style
        if (style.length === 'brief') {
            text = text.split('.')[0] + '.';
        } else if (style.length === 'detailed' && text.split('.').length < 3) {
            text += ' Let me know if you need further clarification.';
        }
        
        // Ensure professional tone
        if (style.tone === 'professional') {
            text = text.replace(/\b(gonna|wanna|gotta)\b/gi, (match) => {
                const replacements = { gonna: 'going to', wanna: 'want to', gotta: 'have to' };
                return replacements[match.toLowerCase()] || match;
            });
        }
        
        return text;
    }

    generateGreeting(emotion) {
        const greetings = [
            `Good day, ${this.userPreferences.name}. How may I assist you?`,
            `Hello, ${this.userPreferences.name}. All systems are ready.`,
            `Greetings, ${this.userPreferences.name}. I'm prepared to help.`,
            `Welcome back, ${this.userPreferences.name}. What can I do for you?`
        ];
        
        return greetings[Math.floor(Math.random() * greetings.length)];
    }

    async answerQuestion(input, emotion) {
        // Simple question answering - in production, integrate with knowledge bases
        if (input.toLowerCase().includes('what are you')) {
            return `I am an advanced holographic AI assistant designed to help you with various tasks and provide intelligent support.`;
        } else if (input.toLowerCase().includes('what can you do')) {
            return `I can assist with system control, information retrieval, task automation, smart home management, data analysis, and creative tasks. What would you like me to help with?`;
        } else {
            return `I understand you're asking about something specific. Let me analyze that for you.`;
        }
    }

    async executeCommand(input, emotion) {
        // Parse command and determine action
        const command = this.parseCommand(input);
        
        return {
            text: `I'll execute that command for you, ${this.userPreferences.name}.`,
            action: {
                type: 'system_command',
                data: command,
                confirmation: this.requiresConfirmation(command)
            },
            confidence: 0.9
        };
    }

    parseCommand(input) {
        const lowerInput = input.toLowerCase();
        
        if (lowerInput.includes('open')) {
            const appName = input.replace(/.*open\s+/i, '').trim();
            return { action: 'open', target: appName };
        } else if (lowerInput.includes('close')) {
            const appName = input.replace(/.*close\s+/i, '').trim();
            return { action: 'close', target: appName };
        }
        
        return { action: 'unknown', original: input };
    }

    requiresConfirmation(command) {
        const sensitiveActions = ['delete', 'format', 'shutdown', 'restart'];
        return sensitiveActions.some(action => command.action.includes(action));
    }

    async performAnalysis(input, emotion) {
        return `I'll perform a comprehensive analysis of that data for you. This may take a moment to ensure accuracy.`;
    }

    async generateCreativeResponse(input, emotion) {
        return `That's an interesting creative request. Let me generate some ideas for you.`;
    }

    async handleSystemCommand(input, emotion) {
        if (input.toLowerCase().includes('mode')) {
            const mode = this.extractMode(input);
            return {
                text: `Switching to ${mode} mode now.`,
                action: {
                    type: 'mode_change',
                    data: { mode: mode }
                }
            };
        }
        return `I'll handle that system command for you.`;
    }

    extractMode(input) {
        const modes = ['analysis', 'execution', 'monitoring', 'creative', 'silent'];
        const lowerInput = input.toLowerCase();
        
        for (const mode of modes) {
            if (lowerInput.includes(mode)) {
                return mode;
            }
        }
        
        return 'monitoring';
    }

    handleEmergency(emotion) {
        return `I understand this is urgent. I'm prioritizing your request and will handle it immediately.`;
    }

    async provideStatus(emotion) {
        return `All systems are functioning normally. I'm ready to assist you with any task.`;
    }

    getCurrentTime(emotion) {
        const now = new Date();
        return `The current time is ${now.toLocaleTimeString()}.`;
    }

    getCurrentDate(emotion) {
        const now = new Date();
        return `Today is ${now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.`;
    }

    async getWeatherInfo(emotion) {
        return `I'll check the current weather conditions for you.`;
    }

    generateFarewell(emotion) {
        const farewells = [
            `Goodbye, ${this.userPreferences.name}. All systems will remain on standby.`,
            `Farewell, ${this.userPreferences.name}. I'm here whenever you need assistance.`,
            `Until next time, ${this.userPreferences.name}. The system is secure and ready.`,
            `Signing off, ${this.userPreferences.name}. Stay safe and efficient.`
        ];
        
        return farewells[Math.floor(Math.random() * farewells.length)];
    }

    generateGeneralResponse(input, emotion) {
        return `I understand your request. Let me process that for you, ${this.userPreferences.name}.`;
    }

    adjustResponseForEmotion(response, emotion) {
        if (emotion.intensity > 0.6) {
            switch (emotion.type) {
                case 'stressed':
                    response.text = `I understand you're under stress. ${response.text} Let's handle this step by step.`;
                    break;
                case 'angry':
                    response.text = `I acknowledge your concern. ${response.text} I'm here to resolve this efficiently.`;
                    break;
                case 'excited':
                    response.text = `I can sense your enthusiasm. ${response.text} This sounds like a great opportunity.`;
                    break;
                case 'fatigued':
                    response.text = `I understand you may be tired. ${response.text} I'll keep this brief and clear.`;
                    break;
            }
        }
        
        return response;
    }

    getConversationHistory() {
        return this.conversationHistory;
    }

    clearConversationHistory() {
        this.conversationHistory = [];
    }

    updateUserPreferences(preferences) {
        this.userPreferences = { ...this.userPreferences, ...preferences };
    }
}

module.exports = { AIAssistant };