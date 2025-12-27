const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
    // Listen for state changes
    onListeningState: (callback) => {
        ipcRenderer.on('listening-state-changed', (event, isListening) => callback(isListening));
    },
    
    onSpeakingState: (callback) => {
        ipcRenderer.on('speaking-state-changed', (event, isSpeaking) => callback(isSpeaking));
    },
    
    onEmotionUpdate: (callback) => {
        ipcRenderer.on('emotion-updated', (event, emotion) => callback(emotion));
    },
    
    onAudioLevel: (callback) => {
        ipcRenderer.on('audio-level-updated', (event, level) => callback(level));
    },
    
    onResponseDisplay: (callback) => {
        ipcRenderer.on('response-display', (event, text) => callback(text));
    },
    
    // Send commands to main process
    toggleListening: () => {
        ipcRenderer.invoke('toggle-listening');
    },
    
    getSystemStatus: () => {
        return ipcRenderer.invoke('get-system-status');
    },
    
    setWakeWord: (wakeWord) => {
        return ipcRenderer.invoke('set-wake-word', wakeWord);
    },
    
    getConversationHistory: (userId) => {
        return ipcRenderer.invoke('get-conversation-history', userId);
    },
    
    updateUserProfile: (userId, profile) => {
        return ipcRenderer.invoke('update-user-profile', userId, profile);
    },
    
    performApiQuery: (query) => {
        return ipcRenderer.invoke('perform-api-query', query);
    }
});