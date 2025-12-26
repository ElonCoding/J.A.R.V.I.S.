const EventEmitter = require('events');

class MultiUserManager extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.activeUsers = new Map();
        this.maxUsers = 5;
        this.userTimeout = 30000; // 30 seconds
    }

    async initialize() {
        this.isInitialized = true;
        console.log('Multi-User Manager initialized');
        this.emit('initialized');
    }

    async addUser(userId) {
        if (this.activeUsers.size >= this.maxUsers) {
            throw new Error('Maximum number of users reached');
        }
        
        this.activeUsers.set(userId, {
            id: userId,
            joinTime: Date.now(),
            lastActivity: Date.now(),
            interactions: 0
        });
        
        this.emit('userJoined', userId);
        return true;
    }

    async removeUser(userId) {
        if (this.activeUsers.has(userId)) {
            this.activeUsers.delete(userId);
            this.emit('userLeft', userId);
            return true;
        }
        return false;
    }

    async updateUserActivity(userId) {
        if (this.activeUsers.has(userId)) {
            const user = this.activeUsers.get(userId);
            user.lastActivity = Date.now();
            user.interactions++;
        }
    }

    getActiveUsers() {
        return Array.from(this.activeUsers.keys());
    }

    getStatus() {
        return {
            active: this.isInitialized,
            activeUsers: this.activeUsers.size,
            maxUsers: this.maxUsers,
            userList: this.getActiveUsers()
        };
    }

    stop() {
        this.activeUsers.clear();
        console.log('Multi-User Manager stopped');
    }
}

module.exports = { MultiUserManager };