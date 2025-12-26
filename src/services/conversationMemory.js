const EventEmitter = require('events');

class ConversationMemoryService extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.conversations = new Map();
        this.maxHistoryLength = 50;
        this.memoryRetention = 30 * 60 * 1000; // 30 minutes
        this.contextWindow = 5; // Number of recent messages to consider
    }

    async initialize() {
        this.isInitialized = true;
        console.log('Conversation Memory Service initialized');
        this.emit('initialized');
    }

    async addMessage(userId, message) {
        if (!this.conversations.has(userId)) {
            this.conversations.set(userId, []);
        }
        
        const userConversations = this.conversations.get(userId);
        userConversations.push({
            ...message,
            id: Date.now() + Math.random(),
            timestamp: message.timestamp || Date.now()
        });
        
        // Trim history
        if (userConversations.length > this.maxHistoryLength) {
            userConversations.shift();
        }
        
        this.emit('messageAdded', { userId, message });
    }

    async getHistory(userId, limit = null) {
        const conversations = this.conversations.get(userId) || [];
        return limit ? conversations.slice(-limit) : conversations;
    }

    async getRecentHistory(userId, count = 5) {
        return this.getHistory(userId, count);
    }

    async getContext(userId) {
        const history = await this.getRecentHistory(userId, this.contextWindow);
        return history.map(msg => ({
            role: msg.type === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));
    }

    getStatus() {
        return {
            active: this.isInitialized,
            totalUsers: this.conversations.size,
            totalMessages: Array.from(this.conversations.values()).reduce((sum, conv) => sum + conv.length, 0),
            maxHistoryLength: this.maxHistoryLength
        };
    }

    stop() {
        console.log('Conversation Memory Service stopped');
    }
}

module.exports = { ConversationMemoryService };