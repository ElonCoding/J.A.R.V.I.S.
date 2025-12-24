const EventEmitter = require('events');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class SecurityManager extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.securityPolicies = new Map();
        this.accessControl = new Map();
        this.encryptionKeys = new Map();
        this.auditLog = [];
        this.threatDetection = new ThreatDetectionSystem();
        this.privacyManager = new PrivacyManager();
        this.authenticationManager = new AuthenticationManager();
        
        // Security configuration
        this.config = {
            maxFailedAttempts: 3,
            lockoutDuration: 5 * 60 * 1000, // 5 minutes
            sessionTimeout: 30 * 60 * 1000, // 30 minutes
            encryptionAlgorithm: 'aes-256-gcm',
            hashAlgorithm: 'sha256',
            auditLogMaxSize: 1000,
            threatDetectionEnabled: true,
            privacyLevel: 'strict', // strict, moderate, minimal
            dataRetentionDays: 30,
            requireConfirmationForSensitive: true,
            allowedDataTypes: new Set(['text', 'commands', 'system_info']),
            blockedDataTypes: new Set(['passwords', 'keys', 'tokens', 'personal_info'])
        };
        
        this.systemState = {
            isLocked: false,
            failedAttempts: new Map(),
            activeSessions: new Map(),
            threatLevel: 'low',
            lastSecurityCheck: null,
            privacyViolations: [],
            securityIncidents: []
        };
        
        this.sensitiveOperations = [
            'format', 'delete', 'shutdown', 'restart', 'kill', 'terminate',
            'uninstall', 'remove', 'disable', 'grant_access', 'revoke_access',
            'export_data', 'import_data', 'backup', 'restore'
        ];
        
        this.personalDataPatterns = [
            /\b\d{3}-\d{2}-\d{4}\b/g, // SSN
            /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, // Credit card
            /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, // Email
            /\b\d{3}-\d{3}-\d{4}\b/g, // Phone number
            /password\s*[:=]\s*\S+/gi,
            /api[_-]?key\s*[:=]\s*\S+/gi,
            /token\s*[:=]\s*\S+/gi
        ];
    }
    
    async initialize() {
        try {
            // Load security policies
            await this.loadSecurityPolicies();
            
            // Initialize encryption keys
            await this.initializeEncryptionKeys();
            
            // Set up threat detection
            await this.threatDetection.initialize();
            
            // Initialize privacy manager
            await this.privacyManager.initialize();
            
            // Initialize authentication manager
            await this.authenticationManager.initialize();
            
            // Start background security checks
            this.startBackgroundSecurityChecks();
            
            this.isInitialized = true;
            console.log('Security manager initialized');
            
            this.logSecurityEvent('system_initialized', { timestamp: new Date().toISOString() });
            
        } catch (error) {
            console.error('Failed to initialize security manager:', error);
            throw error;
        }
    }
    
    async loadSecurityPolicies() {
        try {
            const policiesPath = path.join(__dirname, '../../config/security_policies.json');
            const policiesData = JSON.parse(await fs.readFile(policiesPath, 'utf8').catch(() => '{}'));
            
            for (const [policyName, policy] of Object.entries(policiesData)) {
                this.securityPolicies.set(policyName, policy);
            }
            
            // Set default policies if none loaded
            if (this.securityPolicies.size === 0) {
                this.setDefaultSecurityPolicies();
            }
            
        } catch (error) {
            console.error('Failed to load security policies:', error);
            this.setDefaultSecurityPolicies();
        }
    }
    
    setDefaultSecurityPolicies() {
        const defaultPolicies = {
            data_access: {
                allowUserData: false,
                allowSystemData: true,
                allowNetworkData: false,
                requireConsent: true
            },
            operation_control: {
                requireConfirmation: true,
                maxOperationsPerMinute: 10,
                allowedOperations: ['read', 'list', 'status', 'info'],
                blockedOperations: ['write', 'delete', 'format']
            },
            privacy_protection: {
                anonymizeUserData: true,
                encryptStoredData: true,
                limitDataRetention: true,
                allowThirdPartySharing: false
            },
            threat_response: {
                autoBlockSuspicious: true,
                notifyUserOnThreat: true,
                escalateHighThreats: true,
                quarantineInfectedFiles: true
            }
        };
        
        for (const [policyName, policy] of Object.entries(defaultPolicies)) {
            this.securityPolicies.set(policyName, policy);
        }
    }
    
    async initializeEncryptionKeys() {
        // Generate master encryption key
        const masterKey = crypto.randomBytes(32);
        this.encryptionKeys.set('master', masterKey);
        
        // Generate session key
        const sessionKey = crypto.randomBytes(32);
        this.encryptionKeys.set('session', sessionKey);
        
        // Generate data encryption key
        const dataKey = crypto.randomBytes(32);
        this.encryptionKeys.set('data', dataKey);
    }
    
    async analyzeRequest(input, context = {}) {
        try {
            // Log the request for audit purposes
            this.logSecurityEvent('request_received', {
                input: this.sanitizeForLogging(input),
                context: this.sanitizeForLogging(context),
                timestamp: new Date().toISOString()
            });
            
            // Perform threat analysis
            const threatAnalysis = await this.threatDetection.analyze(input, context);
            
            // Check for sensitive data
            const sensitiveDataCheck = this.checkForSensitiveData(input);
            
            // Verify authorization level
            const authorizationCheck = await this.checkAuthorization(context);
            
            // Privacy check
            const privacyCheck = await this.privacyManager.analyze(input, context);
            
            // Compile security assessment
            const securityAssessment = {
                threatLevel: threatAnalysis.threatLevel,
                threatDetails: threatAnalysis.details,
                hasSensitiveData: sensitiveDataCheck.hasSensitiveData,
                sensitiveDataTypes: sensitiveDataCheck.types,
                authorizationLevel: authorizationCheck.level,
                authorizationValid: authorizationCheck.valid,
                privacyCompliant: privacyCheck.compliant,
                privacyViolations: privacyCheck.violations,
                requiresConfirmation: this.requiresConfirmation(input, context),
                canProceed: this.canProceed(threatAnalysis, sensitiveDataCheck, authorizationCheck, privacyCheck)
            };
            
            // Log security assessment
            this.logSecurityEvent('security_assessment', securityAssessment);
            
            return securityAssessment;
            
        } catch (error) {
            console.error('Security analysis failed:', error);
            
            // Fail secure - deny request
            return {
                threatLevel: 'high',
                threatDetails: ['Security analysis failed'],
                hasSensitiveData: true,
                authorizationLevel: 'none',
                authorizationValid: false,
                privacyCompliant: false,
                canProceed: false,
                error: error.message
            };
        }
    }
    
    async checkAuthorization(context) {
        const userId = context.userId || 'anonymous';
        const sessionId = context.sessionId;
        
        // Check if user is locked out
        if (this.isUserLockedOut(userId)) {
            return {
                level: 'none',
                valid: false,
                reason: 'User locked out due to failed attempts'
            };
        }
        
        // Check session validity
        if (sessionId) {
            const session = this.systemState.activeSessions.get(sessionId);
            if (!session || this.isSessionExpired(session)) {
                return {
                    level: 'guest',
                    valid: false,
                    reason: 'Invalid or expired session'
                };
            }
        }
        
        // Determine authorization level
        const authorizationLevel = context.authorizationLevel || 'guest';
        
        return {
            level: authorizationLevel,
            valid: true,
            userId: userId,
            sessionId: sessionId
        };
    }
    
    isUserLockedOut(userId) {
        const failedAttempts = this.systemState.failedAttempts.get(userId);
        if (!failedAttempts) return false;
        
        const now = Date.now();
        const lockoutEnd = failedAttempts.lockoutEnd;
        
        return lockoutEnd && now < lockoutEnd;
    }
    
    isSessionExpired(session) {
        const now = Date.now();
        return now - session.lastActivity > this.config.sessionTimeout;
    }
    
    checkForSensitiveData(input) {
        const sensitiveTypes = [];
        let hasSensitiveData = false;
        
        for (const pattern of this.personalDataPatterns) {
            if (pattern.test(input)) {
                hasSensitiveData = true;
                const matches = input.match(pattern);
                if (matches) {
                    sensitiveTypes.push(this.classifySensitiveData(matches[0]));
                }
            }
        }
        
        return {
            hasSensitiveData: hasSensitiveData,
            types: [...new Set(sensitiveTypes)]
        };
    }
    
    classifySensitiveData(data) {
        if (/\b\d{3}-\d{2}-\d{4}\b/.test(data)) return 'ssn';
        if (/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/.test(data)) return 'credit_card';
        if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(data)) return 'email';
        if (/\b\d{3}-\d{3}-\d{4}\b/.test(data)) return 'phone';
        if (/password|api[_-]?key|token/i.test(data)) return 'credential';
        return 'unknown';
    }
    
    requiresConfirmation(input, context) {
        // Check if input contains sensitive operations
        const inputLower = input.toLowerCase();
        const hasSensitiveOperation = this.sensitiveOperations.some(op => 
            inputLower.includes(op.toLowerCase())
        );
        
        // Check authorization level
        const isLowAuthorization = context.authorizationLevel === 'guest' || 
                                  context.authorizationLevel === 'user';
        
        // Check for destructive operations
        const hasDestructiveOperation = /delete|format|remove|uninstall/i.test(input);
        
        return hasSensitiveOperation || isLowAuthorization || hasDestructiveOperation;
    }
    
    canProceed(threatAnalysis, sensitiveDataCheck, authorizationCheck, privacyCheck) {
        // Basic security checks
        if (threatAnalysis.threatLevel === 'high') return false;
        if (!authorizationCheck.valid) return false;
        if (!privacyCheck.compliant) return false;
        
        // Context-specific checks
        if (sensitiveDataCheck.hasSensitiveData && 
            authorizationCheck.level === 'guest') {
            return false;
        }
        
        return true;
    }
    
    async requestConfirmation(task, step) {
        try {
            // Log confirmation request
            this.logSecurityEvent('confirmation_requested', {
                taskId: task.id,
                step: step,
                timestamp: new Date().toISOString()
            });
            
            // Create confirmation request
            const confirmationRequest = {
                id: this.generateConfirmationId(),
                taskId: task.id,
                step: step,
                requestedAt: new Date(),
                expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
                status: 'pending'
            };
            
            // Store confirmation request
            await this.storeConfirmationRequest(confirmationRequest);
            
            // Emit confirmation request event
            this.emit('confirmation_required', confirmationRequest);
            
            // Wait for confirmation (with timeout)
            const confirmation = await this.waitForConfirmation(confirmationRequest.id, 30000);
            
            if (confirmation.confirmed) {
                this.logSecurityEvent('confirmation_granted', {
                    confirmationId: confirmationRequest.id,
                    taskId: task.id,
                    timestamp: new Date().toISOString()
                });
                
                // Add to task context for future reference
                if (!task.context.confirmedOperations) {
                    task.context.confirmedOperations = [];
                }
                task.context.confirmedOperations.push(step.action);
                
                return true;
            } else {
                this.logSecurityEvent('confirmation_denied', {
                    confirmationId: confirmationRequest.id,
                    taskId: task.id,
                    timestamp: new Date().toISOString()
                });
                
                return false;
            }
            
        } catch (error) {
            console.error('Confirmation request failed:', error);
            return false;
        }
    }
    
    async waitForConfirmation(confirmationId, timeout) {
        return new Promise((resolve) => {
            const timeoutId = setTimeout(() => {
                resolve({ confirmed: false, reason: 'timeout' });
            }, timeout);
            
            this.once(`confirmation_${confirmationId}`, (confirmation) => {
                clearTimeout(timeoutId);
                resolve(confirmation);
            });
        });
    }
    
    async encryptSensitiveData(data) {
        try {
            const key = this.encryptionKeys.get('data');
            if (!key) {
                throw new Error('Encryption key not available');
            }
            
            const iv = crypto.randomBytes(16);
            const cipher = crypto.createCipher(this.config.encryptionAlgorithm, key);
            
            let encrypted = cipher.update(data, 'utf8', 'hex');
            encrypted += cipher.final('hex');
            
            const authTag = cipher.getAuthTag ? cipher.getAuthTag() : null;
            
            return {
                encrypted: encrypted,
                iv: iv.toString('hex'),
                authTag: authTag ? authTag.toString('hex') : null,
                algorithm: this.config.encryptionAlgorithm
            };
            
        } catch (error) {
            console.error('Encryption failed:', error);
            throw error;
        }
    }
    
    async decryptSensitiveData(encryptedData) {
        try {
            const key = this.encryptionKeys.get('data');
            if (!key) {
                throw new Error('Decryption key not available');
            }
            
            const decipher = crypto.createDecipher(encryptedData.algorithm, key);
            
            if (encryptedData.authTag && decipher.setAuthTag) {
                decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
            }
            
            let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
            decrypted += decipher.final('utf8');
            
            return decrypted;
            
        } catch (error) {
            console.error('Decryption failed:', error);
            throw error;
        }
    }
    
    sanitizeForLogging(data) {
        if (typeof data !== 'string') {
            data = JSON.stringify(data);
        }
        
        // Remove or mask sensitive data
        let sanitized = data;
        
        for (const pattern of this.personalDataPatterns) {
            sanitized = sanitized.replace(pattern, '[REDACTED]');
        }
        
        return sanitized;
    }
    
    logSecurityEvent(eventType, data) {
        const event = {
            id: this.generateEventId(),
            type: eventType,
            timestamp: new Date().toISOString(),
            data: this.sanitizeForLogging(data),
            threatLevel: this.determineThreatLevel(eventType, data)
        };
        
        this.auditLog.push(event);
        
        // Maintain log size limit
        if (this.auditLog.length > this.config.auditLogMaxSize) {
            this.auditLog = this.auditLog.slice(-this.config.auditLogMaxSize);
        }
        
        // Emit security event
        this.emit('security_event', event);
        
        // Handle high-threat events
        if (event.threatLevel === 'high') {
            this.handleHighThreatEvent(event);
        }
    }
    
    determineThreatLevel(eventType, data) {
        const highThreatEvents = [
            'security_threat_detected',
            'unauthorized_access_attempt',
            'sensitive_data_exposed',
            'system_compromise_detected'
        ];
        
        const mediumThreatEvents = [
            'failed_authentication',
            'confirmation_denied',
            'privacy_violation',
            'suspicious_activity'
        ];
        
        if (highThreatEvents.includes(eventType)) return 'high';
        if (mediumThreatEvents.includes(eventType)) return 'medium';
        return 'low';
    }
    
    handleHighThreatEvent(event) {
        console.error('High threat event detected:', event);
        
        // Lock system if necessary
        if (event.type === 'security_threat_detected') {
            this.lockSystem('High threat detected');
        }
        
        // Notify user
        this.emit('security_alert', {
            level: 'high',
            event: event,
            message: 'Security threat detected. System protection activated.'
        });
    }
    
    lockSystem(reason) {
        this.systemState.isLocked = true;
        this.logSecurityEvent('system_locked', { reason: reason });
        this.emit('system_locked', { reason: reason });
    }
    
    unlockSystem() {
        this.systemState.isLocked = false;
        this.logSecurityEvent('system_unlocked', {});
        this.emit('system_unlocked', {});
    }
    
    startBackgroundSecurityChecks() {
        // Periodic security scans
        setInterval(() => {
            this.performSecurityScan();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        // Session cleanup
        setInterval(() => {
            this.cleanupExpiredSessions();
        }, 60 * 1000); // Every minute
    }
    
    async performSecurityScan() {
        try {
            // Check for security vulnerabilities
            const vulnerabilities = await this.scanForVulnerabilities();
            
            // Check system integrity
            const integrityCheck = await this.checkSystemIntegrity();
            
            // Update threat level
            this.updateThreatLevel(vulnerabilities, integrityCheck);
            
            this.systemState.lastSecurityCheck = new Date();
            
        } catch (error) {
            console.error('Security scan failed:', error);
        }
    }
    
    async scanForVulnerabilities() {
        // Placeholder for vulnerability scanning
        return [];
    }
    
    async checkSystemIntegrity() {
        // Placeholder for integrity checking
        return { status: 'ok', issues: [] };
    }
    
    updateThreatLevel(vulnerabilities, integrityCheck) {
        if (vulnerabilities.length > 0 || integrityCheck.issues.length > 0) {
            this.systemState.threatLevel = 'medium';
        } else {
            this.systemState.threatLevel = 'low';
        }
    }
    
    cleanupExpiredSessions() {
        const now = Date.now();
        
        for (const [sessionId, session] of this.systemState.activeSessions) {
            if (this.isSessionExpired(session)) {
                this.systemState.activeSessions.delete(sessionId);
                this.logSecurityEvent('session_expired', { sessionId: sessionId });
            }
        }
    }
    
    generateEventId() {
        return `sec_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    generateConfirmationId() {
        return `conf_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
    }
    
    async storeConfirmationRequest(confirmationRequest) {
        // Store confirmation request for later retrieval
        // Implementation depends on storage mechanism
    }
    
    getSecurityStatus() {
        return {
            isLocked: this.systemState.isLocked,
            threatLevel: this.systemState.threatLevel,
            lastSecurityCheck: this.systemState.lastSecurityCheck,
            activeSessions: this.systemState.activeSessions.size,
            failedAttempts: this.systemState.failedAttempts.size,
            auditLogSize: this.auditLog.length,
            privacyViolations: this.systemState.privacyViolations.length,
            securityIncidents: this.systemState.securityIncidents.length
        };
    }
    
    destroy() {
        this.removeAllListeners();
        this.auditLog = [];
        this.encryptionKeys.clear();
        this.securityPolicies.clear();
        this.accessControl.clear();
    }
    
    getStatus() {
        return {
            active: true,
            threatLevel: this.threatDetection.currentThreatLevel || 'low',
            authorizationLevel: this.authorizationLevel,
            failedAttempts: this.failedAttempts,
            locked: this.isLocked(),
            encryptionEnabled: this.encryptionKeys.size > 0
        };
    }
}

class ThreatDetectionSystem extends EventEmitter {
    constructor() {
        super();
        this.threatPatterns = [
            /rm -rf \//g,
            /format [a-z]:/gi,
            /shutdown -s/gi,
            /del \*\.\*/gi,
            /system32/gi,
            /etc\/passwd/gi
        ];
        
        this.suspiciousPatterns = [
            /select \* from/gi,
            /drop table/gi,
            /exec\(/gi,
            /eval\(/gi,
            /javascript:/gi,
            /<script/gi
        ];
    }
    
    async initialize() {
        console.log('Threat detection system initialized');
    }
    
    async analyze(input, context) {
        const threats = [];
        let threatLevel = 'low';
        
        // Check for direct threats
        for (const pattern of this.threatPatterns) {
            if (pattern.test(input)) {
                threats.push('Direct system threat detected');
                threatLevel = 'high';
                break;
            }
        }
        
        // Check for suspicious patterns
        if (threatLevel === 'low') {
            for (const pattern of this.suspiciousPatterns) {
                if (pattern.test(input)) {
                    threats.push('Suspicious pattern detected');
                    threatLevel = 'medium';
                    break;
                }
            }
        }
        
        // Check for unusual behavior patterns
        const behaviorAnalysis = this.analyzeBehavior(input, context);
        if (behaviorAnalysis.isUnusual) {
            threats.push(behaviorAnalysis.reason);
            threatLevel = Math.max(threatLevel, 'medium');
        }
        
        return {
            threatLevel: threatLevel,
            threats: threats,
            details: {
                inputAnalysis: this.analyzeInputCharacteristics(input),
                contextAnalysis: this.analyzeContext(context),
                behaviorAnalysis: behaviorAnalysis
            }
        };
    }
    
    analyzeBehavior(input, context) {
        // Placeholder for behavior analysis
        return { isUnusual: false, reason: '' };
    }
    
    analyzeInputCharacteristics(input) {
        return {
            length: input.length,
            hasSpecialChars: /[!@#$%^&*(),.?":{}|<>]/g.test(input),
            hasNumbers: /\d/.test(input),
            hasUppercase: /[A-Z]/.test(input)
        };
    }
    
    analyzeContext(context) {
        return {
            hasUserId: !!context.userId,
            hasSession: !!context.sessionId,
            authorizationLevel: context.authorizationLevel || 'none'
        };
    }
}

class PrivacyManager extends EventEmitter {
    constructor() {
        super();
        this.privacyRules = new Map();
        this.dataRetentionPolicies = new Map();
    }
    
    async initialize() {
        await this.loadPrivacyRules();
        console.log('Privacy manager initialized');
    }
    
    async loadPrivacyRules() {
        // Load privacy rules from configuration
        const defaultRules = {
            data_minimization: {
                collectOnlyNecessary: true,
                limitStorageDuration: true,
                anonymizeWhenPossible: true
            },
            user_consent: {
                requireExplicitConsent: true,
                allowWithdrawal: true,
                provideTransparency: true
            },
            data_protection: {
                encryptAtRest: true,
                encryptInTransit: true,
                accessControl: true
            }
        };
        
        for (const [ruleName, rule] of Object.entries(defaultRules)) {
            this.privacyRules.set(ruleName, rule);
        }
    }
    
    async analyze(input, context) {
        const violations = [];
        let compliant = true;
        
        // Check data minimization
        if (this.privacyRules.get('data_minimization')?.collectOnlyNecessary) {
            const unnecessaryData = this.detectUnnecessaryData(input);
            if (unnecessaryData.length > 0) {
                violations.push('Unnecessary data collection detected');
                compliant = false;
            }
        }
        
        // Check user consent
        if (this.privacyRules.get('user_consent')?.requireExplicitConsent) {
            if (!context.hasUserConsent) {
                violations.push('User consent required');
                compliant = false;
            }
        }
        
        return {
            compliant: compliant,
            violations: violations,
            recommendations: this.generatePrivacyRecommendations(input, context)
        };
    }
    
    detectUnnecessaryData(input) {
        // Placeholder for unnecessary data detection
        return [];
    }
    
    generatePrivacyRecommendations(input, context) {
        return [
            'Consider anonymizing user data',
            'Limit data retention period',
            'Provide user with data transparency'
        ];
    }
}

class AuthenticationManager extends EventEmitter {
    constructor() {
        super();
        this.users = new Map();
        this.sessions = new Map();
    }
    
    async initialize() {
        console.log('Authentication manager initialized');
    }
    
    async authenticate(userId, credentials) {
        // Placeholder for authentication logic
        return {
            success: true,
            userId: userId,
            authorizationLevel: 'user'
        };
    }
}

module.exports = { SecurityManager };