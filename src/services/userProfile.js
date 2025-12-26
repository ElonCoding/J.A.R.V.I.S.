const EventEmitter = require('events');

class UserProfileService extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.profiles = new Map();
        this.defaultProfile = {
            name: 'User',
            language: 'en-US',
            preferredVoice: 'default',
            emotionPreference: 'neutral',
            interactionStyle: 'conversational'
        };
    }

    async initialize() {
        this.isInitialized = true;
        console.log('User Profile Service initialized');
        this.emit('initialized');
    }

    async createProfile(userId, profileData) {
        const profile = {
            ...this.defaultProfile,
            ...profileData,
            userId: userId,
            createdAt: Date.now(),
            lastInteraction: Date.now()
        };
        
        this.profiles.set(userId, profile);
        this.emit('profileCreated', { userId, profile });
        
        return profile;
    }

    async updateProfile(userId, profileData) {
        if (!this.profiles.has(userId)) {
            return await this.createProfile(userId, profileData);
        }
        
        const existingProfile = this.profiles.get(userId);
        const updatedProfile = {
            ...existingProfile,
            ...profileData,
            lastInteraction: Date.now()
        };
        
        this.profiles.set(userId, updatedProfile);
        this.emit('profileUpdated', { userId, profile: updatedProfile });
        
        return updatedProfile;
    }

    async getProfile(userId) {
        if (!this.profiles.has(userId)) {
            return await this.createProfile(userId, {});
        }
        
        return this.profiles.get(userId);
    }

    async getContext(userId) {
        const profile = await this.getProfile(userId);
        return {
            userId: userId,
            name: profile.name,
            language: profile.language,
            preferredVoice: profile.preferredVoice,
            emotionPreference: profile.emotionPreference,
            interactionStyle: profile.interactionStyle
        };
    }

    getStatus() {
        return {
            active: this.isInitialized,
            totalProfiles: this.profiles.size,
            defaultProfile: this.defaultProfile
        };
    }

    stop() {
        console.log('User Profile Service stopped');
    }
}

module.exports = { UserProfileService };