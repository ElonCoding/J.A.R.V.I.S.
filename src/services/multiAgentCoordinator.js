const EventEmitter = require('events');

class MultiAgentCoordinator extends EventEmitter {
    constructor() {
        super();
        this.agents = new Map();
        this.activeTasks = new Map();
        this.taskQueue = [];
        this.agentCapabilities = new Map();
        this.taskResults = new Map();
        this.systemState = {
            currentMode: 'monitoring',
            userEmotion: 'neutral',
            authorizationLevel: 'guest',
            activeServices: new Set(),
            performanceMetrics: {
                taskCompletionRate: 0,
                averageResponseTime: 0,
                errorRate: 0
            }
        };
        
        // Agent configuration
        this.agentConfig = {
            reasoning: {
                priority: 1,
                capabilities: ['analysis', 'planning', 'decision_making'],
                maxConcurrentTasks: 2,
                timeout: 30000
            },
            planning: {
                priority: 2,
                capabilities: ['task_decomposition', 'scheduling', 'resource_allocation'],
                maxConcurrentTasks: 3,
                timeout: 45000
            },
            os_control: {
                priority: 3,
                capabilities: ['system_commands', 'file_management', 'automation'],
                maxConcurrentTasks: 1,
                timeout: 20000,
                requiresConfirmation: true
            },
            smart_home: {
                priority: 4,
                capabilities: ['device_control', 'automation', 'energy_management'],
                maxConcurrentTasks: 5,
                timeout: 15000
            },
            security: {
                priority: 0,
                capabilities: ['access_control', 'threat_detection', 'privacy_protection'],
                maxConcurrentTasks: 1,
                timeout: 10000
            },
            emotion: {
                priority: 5,
                capabilities: ['emotion_analysis', 'response_adaptation', 'empathy'],
                maxConcurrentTasks: 2,
                timeout: 5000
            },
            voice: {
                priority: 6,
                capabilities: ['speech_recognition', 'speech_synthesis', 'wake_word_detection'],
                maxConcurrentTasks: 1,
                timeout: 8000
            },
            face: {
                priority: 7,
                capabilities: ['face_recognition', 'user_identification', 'access_control'],
                maxConcurrentTasks: 1,
                timeout: 12000
            }
        };
        
        this.taskPriorities = {
            'emergency': 0,
            'security': 1,
            'user_request': 2,
            'system_maintenance': 3,
            'background': 4
        };
        
        this.isProcessing = false;
        this.maxConcurrentTasks = 10;
        this.taskTimeout = 60000; // 60 seconds default timeout
        this.cleanupInterval = 30000; // Clean up every 30 seconds
        
        // Start background processing
        this.startBackgroundProcessing();
        this.startCleanupTask();
    }
    
    registerAgent(agentType, agentInstance) {
        if (!this.agentConfig[agentType]) {
            throw new Error(`Unknown agent type: ${agentType}`);
        }
        
        this.agents.set(agentType, agentInstance);
        this.agentCapabilities.set(agentType, this.agentConfig[agentType].capabilities);
        
        // Set up agent event listeners
        agentInstance.on('task_completed', (taskId, result) => {
            this.handleAgentTaskCompleted(agentType, taskId, result);
        });
        
        agentInstance.on('task_failed', (taskId, error) => {
            this.handleAgentTaskFailed(agentType, taskId, error);
        });
        
        agentInstance.on('task_progress', (taskId, progress) => {
            this.handleAgentTaskProgress(agentType, taskId, progress);
        });
        
        console.log(`Registered agent: ${agentType}`);
    }
    
    async processUserRequest(userInput, context = {}) {
        const taskId = this.generateTaskId();
        
        try {
            // Security check
            await this.performSecurityCheck(userInput, context);
            
            // Analyze user input and create task plan
            const taskPlan = await this.createTaskPlan(userInput, context);
            
            // Create main task
            const mainTask = {
                id: taskId,
                type: 'user_request',
                priority: this.taskPriorities.user_request,
                input: userInput,
                context: context,
                plan: taskPlan,
                status: 'pending',
                created: new Date(),
                timeout: this.taskTimeout
            };
            
            // Add to task queue
            this.addTask(mainTask);
            
            // Start processing
            this.processTasks();
            
            return {
                taskId: taskId,
                status: 'accepted',
                message: 'Request received and being processed',
                estimatedTime: this.estimateTaskTime(taskPlan)
            };
            
        } catch (error) {
            console.error('Failed to process user request:', error);
            return {
                taskId: taskId,
                status: 'rejected',
                error: error.message,
                reason: this.classifyError(error)
            };
        }
    }
    
    async performSecurityCheck(input, context) {
        // Security agent checks
        const securityAgent = this.agents.get('security');
        if (securityAgent) {
            const securityResult = await securityAgent.analyzeRequest(input, context);
            
            if (securityResult.threatLevel === 'high') {
                throw new Error('Security threat detected');
            }
            
            if (securityResult.requiresAuthorization && context.authorizationLevel === 'guest') {
                throw new Error('Authorization required');
            }
        }
        
        // Privacy check
        if (this.containsSensitiveData(input)) {
            throw new Error('Sensitive data detected');
        }
    }
    
    async createTaskPlan(userInput, context) {
        // Use reasoning agent to analyze and plan
        const reasoningAgent = this.agents.get('reasoning');
        if (reasoningAgent) {
            return await reasoningAgent.analyzeIntent(userInput, context);
        }
        
        // Fallback to basic planning
        return {
            intent: 'unknown',
            steps: [{
                agent: 'voice',
                action: 'respond',
                parameters: { message: 'I need more information to help with that.' }
            }]
        };
    }
    
    addTask(task) {
        this.taskQueue.push(task);
        this.taskQueue.sort((a, b) => a.priority - b.priority);
        this.activeTasks.set(task.id, task);
        
        console.log(`Added task ${task.id} to queue`);
    }
    
    async processTasks() {
        if (this.isProcessing || this.taskQueue.length === 0) {
            return;
        }
        
        this.isProcessing = true;
        
        while (this.taskQueue.length > 0 && this.getActiveTaskCount() < this.maxConcurrentTasks) {
            const task = this.taskQueue.shift();
            
            try {
                await this.executeTask(task);
            } catch (error) {
                console.error(`Task execution failed: ${task.id}`, error);
                this.handleTaskError(task, error);
            }
        }
        
        this.isProcessing = false;
    }
    
    async executeTask(task) {
        task.status = 'executing';
        task.started = new Date();
        
        console.log(`Executing task ${task.id}`);
        
        // Execute task plan
        const results = [];
        
        for (const step of task.plan.steps) {
            try {
                const stepResult = await this.executeTaskStep(task, step);
                results.push(stepResult);
                
                // Check if step indicates task completion
                if (stepResult.complete) {
                    break;
                }
                
            } catch (error) {
                console.error(`Step execution failed: ${step.action}`, error);
                results.push({
                    success: false,
                    error: error.message,
                    step: step
                });
                
                // Decide whether to continue or abort
                if (!this.canContinueOnError(task, step, error)) {
                    throw error;
                }
            }
        }
        
        // Compile final result
        const finalResult = this.compileTaskResults(task, results);
        
        // Mark task as completed
        task.status = 'completed';
        task.completed = new Date();
        task.result = finalResult;
        
        this.taskResults.set(task.id, finalResult);
        this.emit('task_completed', task.id, finalResult);
        
        return finalResult;
    }
    
    async executeTaskStep(task, step) {
        const agent = this.agents.get(step.agent);
        
        if (!agent) {
            throw new Error(`Agent not available: ${step.agent}`);
        }
        
        // Check agent availability
        if (!this.isAgentAvailable(step.agent)) {
            throw new Error(`Agent ${step.agent} is busy`);
        }
        
        // Security check for sensitive operations
        if (this.isSensitiveOperation(step) && !await this.confirmSensitiveOperation(task, step)) {
            throw new Error('Sensitive operation requires confirmation');
        }
        
        // Execute step with timeout
        const timeout = this.agentConfig[step.agent].timeout;
        const stepPromise = agent.execute(step.action, step.parameters, task.context);
        
        const result = await this.withTimeout(stepPromise, timeout, `Step timeout: ${step.action}`);
        
        return {
            success: true,
            result: result,
            step: step
        };
    }
    
    isAgentAvailable(agentType) {
        const agent = this.agents.get(agentType);
        if (!agent) return false;
        
        const config = this.agentConfig[agentType];
        const activeTasks = this.getAgentActiveTasks(agentType);
        
        return activeTasks < config.maxConcurrentTasks;
    }
    
    getAgentActiveTasks(agentType) {
        return Array.from(this.activeTasks.values()).filter(task => 
            task.status === 'executing' && 
            task.plan.steps.some(step => step.agent === agentType)
        ).length;
    }
    
    isSensitiveOperation(step) {
        const sensitiveActions = [
            'format', 'delete', 'shutdown', 'restart', 'kill',
            'uninstall', 'remove', 'disable', 'grant_access'
        ];
        
        return sensitiveActions.some(action => 
            step.action.toLowerCase().includes(action) ||
            (step.parameters && Object.values(step.parameters).some(param => 
                typeof param === 'string' && sensitiveActions.some(action => 
                    param.toLowerCase().includes(action)
                )
            ))
        );
    }
    
    async confirmSensitiveOperation(task, step) {
        // Check if user has confirmed this operation
        if (task.context.confirmedOperations && task.context.confirmedOperations.includes(step.action)) {
            return true;
        }
        
        // Request confirmation from security agent
        const securityAgent = this.agents.get('security');
        if (securityAgent) {
            const confirmation = await securityAgent.requestConfirmation(task, step);
            return confirmation.confirmed;
        }
        
        return false;
    }
    
    canContinueOnError(task, step, error) {
        // Check if this is a critical step
        if (step.critical) {
            return false;
        }
        
        // Check error type
        if (error.message.includes('Security') || error.message.includes('Authorization')) {
            return false;
        }
        
        // Check task configuration
        return task.context.allowPartialFailure !== false;
    }
    
    compileTaskResults(task, results) {
        const successfulResults = results.filter(r => r.success);
        const failedResults = results.filter(r => !r.success);
        
        // Determine primary result
        let primaryResult = null;
        if (successfulResults.length > 0) {
            // Use the last successful result as primary
            primaryResult = successfulResults[successfulResults.length - 1].result;
        }
        
        // Generate unified response
        const unifiedResponse = this.generateUnifiedResponse(task, results);
        
        return {
            success: successfulResults.length > 0,
            primaryResult: primaryResult,
            allResults: results,
            successfulSteps: successfulResults.length,
            failedSteps: failedResults.length,
            unifiedResponse: unifiedResponse,
            executionTime: Date.now() - task.started.getTime()
        };
    }
    
    generateUnifiedResponse(task, results) {
        // Use emotion agent to adapt response tone
        const emotionAgent = this.agents.get('emotion');
        let tone = 'professional';
        
        if (emotionAgent) {
            tone = emotionAgent.determineResponseTone(task.context.userEmotion, results);
        }
        
        // Generate response based on results
        if (results.every(r => r.success)) {
            return this.generateSuccessResponse(task, results, tone);
        } else if (results.some(r => r.success)) {
            return this.generatePartialSuccessResponse(task, results, tone);
        } else {
            return this.generateFailureResponse(task, results, tone);
        }
    }
    
    generateSuccessResponse(task, results, tone) {
        const lastResult = results[results.length - 1];
        
        if (lastResult.result && lastResult.result.response) {
            return lastResult.result.response;
        }
        
        return "Task completed successfully, Sir.";
    }
    
    generatePartialSuccessResponse(task, results, tone) {
        const successfulCount = results.filter(r => r.success).length;
        const totalCount = results.length;
        
        return `Task partially completed. ${successfulCount} of ${totalCount} steps succeeded, Sir.`;
    }
    
    generateFailureResponse(task, results, tone) {
        const firstError = results.find(r => !r.success);
        
        if (firstError && firstError.error) {
            return `Unable to complete the task. ${firstError.error}, Sir.`;
        }
        
        return "Task failed to complete, Sir.";
    }
    
    handleAgentTaskCompleted(agentType, taskId, result) {
        console.log(`Agent ${agentType} completed task ${taskId}`);
        
        // Update system state
        this.updateSystemState(agentType, 'completed', result);
        
        // Check if this completes a multi-agent task
        this.checkTaskCompletion(taskId);
    }
    
    handleAgentTaskFailed(agentType, taskId, error) {
        console.error(`Agent ${agentType} failed task ${taskId}:`, error);
        
        // Update system state
        this.updateSystemState(agentType, 'failed', error);
        
        // Handle task failure
        this.handleTaskFailure(taskId, error);
    }
    
    handleAgentTaskProgress(agentType, taskId, progress) {
        console.log(`Agent ${agentType} progress on task ${taskId}:`, progress);
        
        // Update task progress
        const task = this.activeTasks.get(taskId);
        if (task) {
            task.progress = progress;
            this.emit('task_progress', taskId, progress);
        }
    }
    
    updateSystemState(agentType, status, data) {
        this.systemState.activeServices.add(agentType);
        
        // Update performance metrics
        if (status === 'completed') {
            this.updatePerformanceMetrics(true, data);
        } else if (status === 'failed') {
            this.updatePerformanceMetrics(false, data);
        }
    }
    
    updatePerformanceMetrics(success, data) {
        const metrics = this.systemState.performanceMetrics;
        
        if (success) {
            // Update completion rate
            metrics.taskCompletionRate = Math.min(1, metrics.taskCompletionRate + 0.01);
            
            // Update average response time
            if (data && data.executionTime) {
                const currentAvg = metrics.averageResponseTime;
                metrics.averageResponseTime = currentAvg === 0 ? 
                    data.executionTime : 
                    (currentAvg + data.executionTime) / 2;
            }
        } else {
            // Update error rate
            metrics.errorRate = Math.min(1, metrics.errorRate + 0.02);
        }
    }
    
    checkTaskCompletion(taskId) {
        const task = this.activeTasks.get(taskId);
        if (!task || task.status !== 'executing') {
            return;
        }
        
        // Check if all required agents have completed their work
        const requiredAgents = new Set(task.plan.steps.map(step => step.agent));
        const completedAgents = new Set();
        
        for (const step of task.plan.steps) {
            const stepResult = this.getStepResult(taskId, step);
            if (stepResult && stepResult.success) {
                completedAgents.add(step.agent);
            }
        }
        
        if (completedAgents.size === requiredAgents.size) {
            this.completeTask(taskId);
        }
    }
    
    getStepResult(taskId, step) {
        // This would retrieve the result of a specific step
        // Implementation depends on how results are stored
        return null;
    }
    
    completeTask(taskId) {
        const task = this.activeTasks.get(taskId);
        if (task) {
            task.status = 'completed';
            task.completed = new Date();
            
            console.log(`Task ${taskId} completed successfully`);
            this.emit('task_completed', taskId, task.result);
        }
    }
    
    handleTaskFailure(taskId, error) {
        const task = this.activeTasks.get(taskId);
        if (task) {
            task.status = 'failed';
            task.error = error;
            task.completed = new Date();
            
            console.error(`Task ${taskId} failed:`, error);
            this.emit('task_failed', taskId, error);
        }
    }
    
    handleTaskError(task, error) {
        task.status = 'failed';
        task.error = error;
        task.completed = new Date();
        
        console.error(`Task ${task.id} failed:`, error);
        this.emit('task_failed', task.id, error);
    }
    
    withTimeout(promise, timeout, message) {
        return Promise.race([
            promise,
            new Promise((_, reject) => 
                setTimeout(() => reject(new Error(message)), timeout)
            )
        ]);
    }
    
    startBackgroundProcessing() {
        setInterval(() => {
            this.processTasks();
        }, 1000); // Check every second
    }
    
    startCleanupTask() {
        setInterval(() => {
            this.cleanupCompletedTasks();
        }, this.cleanupInterval);
    }
    
    cleanupCompletedTasks() {
        const now = Date.now();
        const maxAge = 5 * 60 * 1000; // 5 minutes
        
        for (const [taskId, task] of this.activeTasks) {
            if (task.completed && (now - task.completed.getTime()) > maxAge) {
                this.activeTasks.delete(taskId);
                this.taskResults.delete(taskId);
            }
        }
    }
    
    getActiveTaskCount() {
        return Array.from(this.activeTasks.values()).filter(task => 
            task.status === 'executing'
        ).length;
    }
    
    async initialize(services) {
        console.log('Initializing MultiAgentCoordinator...');
        
        // Store reference to all services
        this.services = services;
        
        // Register available agents based on services
        const availableAgents = [
            'security', 'face', 'voice', 'emotion', 
            'automation', 'smart_home', 'reasoning', 'planning'
        ];
        
        for (const agentType of availableAgents) {
            if (services[agentType]) {
                try {
                    this.registerAgent(agentType, services[agentType]);
                    console.log(`Registered ${agentType} agent`);
                } catch (error) {
                    console.error(`Failed to register ${agentType} agent:`, error);
                }
            }
        }
        
        // Set up service event listeners
        this.setupServiceListeners();
        
        // Create reasoning and planning agents
        this.createReasoningAgent();
        this.createPlanningAgent();
        
        console.log('MultiAgentCoordinator initialized successfully');
        this.emit('coordinator_initialized');
    }
    
    setupServiceListeners() {
        // Listen for service status changes
        if (this.services.security) {
            this.services.security.on('security_alert', (alert) => {
                this.handleSecurityAlert(alert);
            });
        }
        
        if (this.services.emotion) {
            this.services.emotion.on('emotion_changed', (emotionData) => {
                this.systemState.userEmotion = emotionData.dominantEmotion;
            });
        }
        
        if (this.services.face) {
            this.services.face.on('user_detected', (userData) => {
                this.handleUserDetection(userData);
            });
        }
    }
    
    handleSecurityAlert(alert) {
        console.log('Security alert received:', alert);
        
        if (alert.level === 'high') {
            // Immediately process security tasks
            const securityTask = {
                id: this.generateTaskId(),
                type: 'security',
                priority: this.taskPriorities.security,
                input: `Security alert: ${alert.message}`,
                context: { alert: alert },
                plan: {
                    steps: [{
                        agent: 'security',
                        action: 'handle_alert',
                        parameters: { alert: alert }
                    }]
                },
                status: 'pending',
                created: new Date(),
                timeout: 10000
            };
            
            this.addTask(securityTask);
        }
    }
    
    handleUserDetection(userData) {
        console.log('User detection event:', userData);
        
        // Update authorization level based on user recognition
        if (userData.recognized) {
            this.systemState.authorizationLevel = userData.authorizationLevel || 'user';
        } else {
            this.systemState.authorizationLevel = 'guest';
        }
    }
    
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    getSystemStatus() {
        return {
            activeTasks: this.getActiveTaskCount(),
            queuedTasks: this.taskQueue.length,
            availableAgents: Array.from(this.agents.keys()),
            systemState: this.systemState,
            performanceMetrics: this.systemState.performanceMetrics
        };
    }
    
    getServiceStatus() {
        return {
            coordinator: {
                active: true,
                agents: Array.from(this.agents.keys()),
                activeTasks: this.getActiveTaskCount(),
                queuedTasks: this.taskQueue.length
            },
            services: {
                security: this.services.security ? this.services.security.getStatus() : { active: false },
                face: this.services.face ? this.services.face.getStatus() : { active: false },
                voice: this.services.voice ? this.services.voice.getStatus() : { active: false },
                emotion: this.services.emotion ? this.services.emotion.getStatus() : { active: false },
                automation: this.services.automation ? this.services.automation.getStatus() : { active: false },
                smartHome: this.services.smartHome ? this.services.smartHome.getStatus() : { active: false }
            }
        };
    }
    
    getRecentCommands() {
        return Array.from(this.taskResults.entries())
            .slice(-5)
            .map(([taskId, result]) => ({
                taskId,
                success: result.success,
                timestamp: result.timestamp || new Date()
            }));
    }
    
    generateTaskId() {
        return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    estimateTaskTime(taskPlan) {
        // Estimate based on agent timeouts and step count
        const totalTime = taskPlan.steps.reduce((total, step) => {
            const agentTimeout = this.agentConfig[step.agent]?.timeout || 10000;
            return total + agentTimeout;
        }, 0);
        
        return Math.min(totalTime, this.taskTimeout);
    }
    
    containsSensitiveData(input) {
        const sensitivePatterns = [
            /password\s*[:=]\s*\S+/i,
            /api[_-]?key\s*[:=]\s*\S+/i,
            /token\s*[:=]\s*\S+/i,
            /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
            /\b\d{3}-\d{2}-\d{4}\b/ // SSN
        ];
        
        return sensitivePatterns.some(pattern => pattern.test(input));
    }
    
    classifyError(error) {
        if (error.message.includes('Security')) return 'security';
        if (error.message.includes('Authorization')) return 'authorization';
        if (error.message.includes('Timeout')) return 'timeout';
        if (error.message.includes('Network')) return 'network';
        return 'unknown';
    }
    

    
    createReasoningAgent() {
        // Simple reasoning agent for simulation
        const reasoningAgent = new EventEmitter();
        reasoningAgent.analyzeIntent = async (userInput, context) => {
            console.log('Reasoning agent analyzing intent:', userInput);
            
            // Simple intent analysis
            const intents = {
                'lights': 'smart_home',
                'temperature': 'smart_home',
                'music': 'entertainment',
                'weather': 'information',
                'time': 'information',
                'help': 'assistance'
            };
            
            let detectedIntent = 'unknown';
            for (const [keyword, intent] of Object.entries(intents)) {
                if (userInput.toLowerCase().includes(keyword)) {
                    detectedIntent = intent;
                    break;
                }
            }
            
            return {
                intent: detectedIntent,
                confidence: 0.8,
                steps: [{
                    agent: detectedIntent === 'smart_home' ? 'smart_home' : 'voice',
                    action: 'respond',
                    parameters: { message: `I understand you want ${detectedIntent}. Let me help with that.` }
                }]
            };
        };
        
        this.registerAgent('reasoning', reasoningAgent);
    }
    
    createPlanningAgent() {
        // Simple planning agent for simulation
        const planningAgent = new EventEmitter();
        planningAgent.planTask = async (task, context) => {
            console.log('Planning agent creating task plan:', task);
            
            return {
                steps: [{
                    agent: 'voice',
                    action: 'acknowledge',
                    parameters: { message: 'Processing your request...' }
                }, {
                    agent: 'reasoning',
                    action: 'analyze',
                    parameters: { input: task.input }
                }, {
                    agent: 'voice',
                    action: 'respond',
                    parameters: { message: 'Task completed.' }
                }]
            };
        };
        
        this.registerAgent('planning', planningAgent);
    }
    
    destroy() {
        this.removeAllListeners();
        this.taskQueue = [];
        this.activeTasks.clear();
        this.taskResults.clear();
    }
}

module.exports = { MultiAgentCoordinator };