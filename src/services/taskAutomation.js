const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const fs = require('fs').promises;
const path = require('path');
const si = require('systeminformation');
const EventEmitter = require('events');

const execPromise = promisify(exec);

class TaskAutomationService extends EventEmitter {
    constructor() {
        super();
        this.isInitialized = false;
        this.automationScripts = new Map();
        this.runningProcesses = new Map();
        this.systemInfo = null;
        this.userPreferences = new Map();
        this.scheduledTasks = new Map();
        this.workflowTemplates = new Map();
        this.sensitiveCapabilities = new Set();
        this.lockedCapabilities = false;
        
        // Define sensitive operations that require confirmation
        this.sensitiveOperations = [
            'format', 'delete', 'shutdown', 'restart', 'kill', 'terminate',
            'uninstall', 'remove', 'disable', 'format', 'partition'
        ];
        
        // System command mappings
        this.systemCommands = {
            windows: {
                shutdown: 'shutdown /s /t 0',
                restart: 'shutdown /r /t 0',
                sleep: 'rundll32.exe powrprof.dll,SetSuspendState 0,1,0',
                hibernate: 'shutdown /h',
                lock: 'rundll32.exe user32.dll,LockWorkStation',
                emptyRecycleBin: 'rd /s /q C:\\$Recycle.Bin'
            },
            darwin: {
                shutdown: 'sudo shutdown -h now',
                restart: 'sudo shutdown -r now',
                sleep: 'pmset sleepnow',
                lock: '/System/Library/CoreServices/Menu\\ Extras/User.menu/Contents/Resources/CGSession -suspend'
            },
            linux: {
                shutdown: 'sudo shutdown -h now',
                restart: 'sudo shutdown -r now',
                sleep: 'systemctl suspend',
                hibernate: 'systemctl hibernate',
                lock: 'gnome-screensaver-command -l'
            }
        };
        
        this.platform = process.platform;
    }

    async initialize() {
        try {
            console.log('Initializing Task Automation Service...');
            
            // Get system information
            this.systemInfo = await this.getSystemInfo();
            
            // Load automation scripts
            await this.loadAutomationScripts();
            
            // Load user preferences
            await this.loadUserPreferences();
            
            // Load workflow templates
            await this.loadWorkflowTemplates();
            
            this.isInitialized = true;
            console.log('Task automation service initialized');
            this.emit('initialized');
            
        } catch (error) {
            console.error('Failed to initialize task automation:', error);
            this.emit('error', error);
            throw error;
        }
    }

    async getSystemInfo() {
        try {
            const [cpu, mem, os, graphics, network] = await Promise.all([
                si.cpu(),
                si.mem(),
                si.osInfo(),
                si.graphics(),
                si.networkInterfaces()
            ]);
            
            return {
                cpu: {
                    manufacturer: cpu.manufacturer,
                    brand: cpu.brand,
                    speed: cpu.speed,
                    cores: cpu.cores,
                    physicalCores: cpu.physicalCores
                },
                memory: {
                    total: mem.total,
                    free: mem.free,
                    used: mem.used,
                    active: mem.active
                },
                os: {
                    platform: os.platform,
                    distro: os.distro,
                    release: os.release,
                    arch: os.arch
                },
                graphics: graphics.controllers.map(gpu => ({
                    model: gpu.model,
                    vendor: gpu.vendor,
                    vram: gpu.vram,
                    driverVersion: gpu.driverVersion
                })),
                network: network.map(iface => ({
                    name: iface.iface,
                    ip4: iface.ip4,
                    ip6: iface.ip6,
                    mac: iface.mac
                }))
            };
        } catch (error) {
            console.error('Failed to get system information:', error);
            return null;
        }
    }

    async loadAutomationScripts() {
        try {
            const scriptsPath = path.join(__dirname, '../../automation/scripts');
            const scriptFiles = await fs.readdir(scriptsPath).catch(() => []);
            
            for (const file of scriptFiles) {
                if (file.endsWith('.json')) {
                    const scriptName = path.basename(file, '.json');
                    const scriptData = JSON.parse(
                        await fs.readFile(path.join(scriptsPath, file), 'utf8')
                    );
                    this.automationScripts.set(scriptName, scriptData);
                }
            }
            
            console.log(`Loaded ${this.automationScripts.size} automation scripts`);
        } catch (error) {
            console.error('Failed to load automation scripts:', error);
        }
    }

    async loadUserPreferences() {
        try {
            const prefsPath = path.join(__dirname, '../../config/user_preferences.json');
            const prefsData = JSON.parse(await fs.readFile(prefsPath, 'utf8').catch(() => '{}'));
            
            for (const [key, value] of Object.entries(prefsData)) {
                this.userPreferences.set(key, value);
            }
            
            console.log('Loaded user preferences');
        } catch (error) {
            console.error('Failed to load user preferences:', error);
        }
    }

    async loadWorkflowTemplates() {
        try {
            const templatesPath = path.join(__dirname, '../../automation/templates');
            const templateFiles = await fs.readdir(templatesPath).catch(() => []);
            
            for (const file of templateFiles) {
                if (file.endsWith('.json')) {
                    const templateName = path.basename(file, '.json');
                    const templateData = JSON.parse(
                        await fs.readFile(path.join(templatesPath, file), 'utf8')
                    );
                    this.workflowTemplates.set(templateName, templateData);
                }
            }
            
            console.log(`Loaded ${this.workflowTemplates.size} workflow templates`);
        } catch (error) {
            console.error('Failed to load workflow templates:', error);
        }
    }

    async executeCommand(command) {
        try {
            // Validate command
            if (!this.validateCommand(command)) {
                throw new Error('Invalid or unsafe command');
            }
            
            // Check if operation is sensitive
            if (this.isSensitiveOperation(command)) {
                return {
                    success: false,
                    requiresConfirmation: true,
                    message: 'This operation requires confirmation due to its sensitive nature.'
                };
            }
            
            // Execute based on command type
            let result;
            switch (command.type) {
                case 'system':
                    result = await this.executeSystemCommand(command);
                    break;
                case 'application':
                    result = await this.executeApplicationCommand(command);
                    break;
                case 'file':
                    result = await this.executeFileCommand(command);
                    break;
                case 'network':
                    result = await this.executeNetworkCommand(command);
                    break;
                case 'automation':
                    result = await this.executeAutomationScript(command);
                    break;
                case 'workflow':
                    result = await this.executeWorkflow(command);
                    break;
                default:
                    throw new Error(`Unknown command type: ${command.type}`);
            }
            
            const response = {
                success: true,
                result: result,
                timestamp: new Date().toISOString()
            };
            
            this.emit('task_completed', command.id || 'unknown', response);
            return response;
            
        } catch (error) {
            console.error('Command execution failed:', error);
            const errorResponse = {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
            
            this.emit('task_failed', command.id || 'unknown', error);
            return errorResponse;
        }
    }

    validateCommand(command) {
        if (!command || !command.action) {
            return false;
        }
        
        // Check for potentially dangerous commands
        const dangerousPatterns = [
            /rm\s+(-rf|\*)\s*\/\s*/,
            /format\s+\w+:/,
            /del\s+\*\.\*/,
            /sudo\s+rm/,
            /regedit.*delete/i,
            /powershell.*remove-item/i
        ];
        
        const commandString = JSON.stringify(command).toLowerCase();
        
        for (const pattern of dangerousPatterns) {
            if (pattern.test(commandString)) {
                console.warn('Dangerous command pattern detected:', command);
                return false;
            }
        }
        
        return true;
    }

    isSensitiveOperation(command) {
        const commandString = JSON.stringify(command).toLowerCase();
        return this.sensitiveOperations.some(op => commandString.includes(op));
    }

    async executeSystemCommand(command) {
        const { action, target, parameters } = command;
        
        // Get platform-specific command
        const platformCommands = this.systemCommands[this.platform];
        if (!platformCommands) {
            throw new Error(`Unsupported platform: ${this.platform}`);
        }
        
        let systemCommand;
        
        switch (action) {
            case 'shutdown':
                systemCommand = platformCommands.shutdown;
                break;
            case 'restart':
                systemCommand = platformCommands.restart;
                break;
            case 'sleep':
                systemCommand = platformCommands.sleep;
                break;
            case 'hibernate':
                systemCommand = platformCommands.hibernate;
                break;
            case 'lock':
                systemCommand = platformCommands.lock;
                break;
            default:
                throw new Error(`Unknown system action: ${action}`);
        }
        
        if (parameters && parameters.confirmation) {
            return await this.executeCommandWithConfirmation(systemCommand);
        }
        
        return await this.executeShellCommand(systemCommand);
    }

    async executeApplicationCommand(command) {
        const { action, target, parameters } = command;
        
        switch (action) {
            case 'open':
                return await this.openApplication(target, parameters);
            case 'close':
                return await this.closeApplication(target, parameters);
            case 'minimize':
                return await this.minimizeApplication(target, parameters);
            case 'maximize':
                return await this.maximizeApplication(target, parameters);
            default:
                throw new Error(`Unknown application action: ${action}`);
        }
    }

    async openApplication(appName, parameters) {
        try {
            let command;
            
            switch (this.platform) {
                case 'win32':
                    command = `start "" "${appName}"`;
                    break;
                case 'darwin':
                    command = `open -a "${appName}"`;
                    break;
                case 'linux':
                    command = `${appName.toLowerCase()} &`;
                    break;
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
            
            return await this.executeShellCommand(command);
        } catch (error) {
            throw new Error(`Failed to open application: ${error.message}`);
        }
    }

    async closeApplication(appName, parameters) {
        try {
            let command;
            
            switch (this.platform) {
                case 'win32':
                    command = `taskkill /F /IM ${appName}.exe`;
                    break;
                case 'darwin':
                    command = `pkill -f "${appName}"`;
                    break;
                case 'linux':
                    command = `pkill -f "${appName}"`;
                    break;
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
            
            return await this.executeShellCommand(command);
        } catch (error) {
            throw new Error(`Failed to close application: ${error.message}`);
        }
    }

    async executeFileCommand(command) {
        const { action, target, parameters } = command;
        
        switch (action) {
            case 'create':
                return await this.createFile(target, parameters);
            case 'delete':
                return await this.deleteFile(target, parameters);
            case 'move':
                return await this.moveFile(target, parameters);
            case 'copy':
                return await this.copyFile(target, parameters);
            case 'open':
                return await this.openFile(target, parameters);
            default:
                throw new Error(`Unknown file action: ${action}`);
        }
    }

    async createFile(filePath, parameters) {
        try {
            const content = parameters.content || '';
            await fs.writeFile(filePath, content, 'utf8');
            return { message: `File created: ${filePath}` };
        } catch (error) {
            throw new Error(`Failed to create file: ${error.message}`);
        }
    }

    async deleteFile(filePath, parameters) {
        try {
            await fs.unlink(filePath);
            return { message: `File deleted: ${filePath}` };
        } catch (error) {
            throw new Error(`Failed to delete file: ${error.message}`);
        }
    }

    async executeNetworkCommand(command) {
        const { action, target, parameters } = command;
        
        switch (action) {
            case 'ping':
                return await this.pingHost(target);
            case 'traceroute':
                return await this.tracerouteHost(target);
            case 'port_scan':
                return await this.scanPorts(target, parameters);
            default:
                throw new Error(`Unknown network action: ${action}`);
        }
    }

    async pingHost(host) {
        try {
            let command;
            switch (this.platform) {
                case 'win32':
                    command = `ping -n 4 ${host}`;
                    break;
                default:
                    command = `ping -c 4 ${host}`;
            }
            
            const result = await this.executeShellCommand(command);
            return { host, result };
        } catch (error) {
            throw new Error(`Failed to ping host: ${error.message}`);
        }
    }

    async executeAutomationScript(command) {
        const scriptName = command.script;
        const script = this.automationScripts.get(scriptName);
        
        if (!script) {
            throw new Error(`Unknown automation script: ${scriptName}`);
        }
        
        let result = '';
        for (const step of script.steps) {
            const stepResult = await this.executeCommand(step);
            if (!stepResult.success) {
                throw new Error(`Script step failed: ${stepResult.error}`);
            }
            result += stepResult.result + '\n';
        }
        
        return { message: `Script executed: ${scriptName}`, result };
    }

    async executeWorkflow(command) {
        const workflowName = command.workflow;
        const workflow = this.workflowTemplates.get(workflowName);
        
        if (!workflow) {
            throw new Error(`Unknown workflow: ${workflowName}`);
        }
        
        let result = '';
        for (const step of workflow.steps) {
            const stepResult = await this.executeCommand(step);
            if (!stepResult.success && !step.optional) {
                throw new Error(`Workflow step failed: ${stepResult.error}`);
            }
            result += stepResult.result + '\n';
        }
        
        return { message: `Workflow executed: ${workflowName}`, result };
    }

    async executeShellCommand(command, options = {}) {
        return new Promise((resolve, reject) => {
            const timeout = options.timeout || 30000;
            const child = exec(command, { timeout }, (error, stdout, stderr) => {
                if (error) {
                    reject(new Error(`Command failed: ${error.message}`));
                } else {
                    resolve(stdout || stderr || 'Command executed successfully');
                }
            });
            
            // Store process for potential termination
            this.runningProcesses.set(child.pid, child);
            
            child.on('exit', () => {
                this.runningProcesses.delete(child.pid);
            });
        });
    }

    async executeCommandWithConfirmation(command) {
        // This would typically prompt the user for confirmation
        // For now, we'll simulate a confirmation requirement
        return {
            requiresConfirmation: true,
            command: command,
            message: 'This command requires user confirmation'
        };
    }

    lockSensitiveCapabilities() {
        this.lockedCapabilities = true;
        console.log('Sensitive capabilities locked');
    }

    unlockSensitiveCapabilities() {
        this.lockedCapabilities = false;
        console.log('Sensitive capabilities unlocked');
    }

    areCapabilitiesLocked() {
        return this.lockedCapabilities;
    }

    async getRunningProcesses() {
        try {
            let command;
            switch (this.platform) {
                case 'win32':
                    command = 'tasklist /FO CSV';
                    break;
                case 'darwin':
                    command = 'ps -ax';
                    break;
                case 'linux':
                    command = 'ps -ax';
                    break;
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
            
            const result = await this.executeShellCommand(command);
            return this.parseProcessList(result);
        } catch (error) {
            throw new Error(`Failed to get running processes: ${error.message}`);
        }
    }

    parseProcessList(processList) {
        // Basic process list parsing - would need platform-specific implementation
        const lines = processList.split('\n');
        const processes = [];
        
        for (let i = 1; i < lines.length; i++) { // Skip header
            const line = lines[i].trim();
            if (line) {
                processes.push({ name: line.split(',')[0] || line.split(/\s+/)[4] || 'Unknown' });
            }
        }
        
        return processes;
    }

    async terminateProcess(processName) {
        try {
            let command;
            switch (this.platform) {
                case 'win32':
                    command = `taskkill /F /IM ${processName}`;
                    break;
                case 'darwin':
                case 'linux':
                    command = `pkill -f "${processName}"`;
                    break;
                default:
                    throw new Error(`Unsupported platform: ${this.platform}`);
            }
            
            return await this.executeShellCommand(command);
        } catch (error) {
            throw new Error(`Failed to terminate process: ${error.message}`);
        }
    }

    async scheduleTask(taskName, command, schedule) {
        // Basic task scheduling implementation
        const taskId = `${taskName}_${Date.now()}`;
        
        const task = {
            id: taskId,
            name: taskName,
            command: command,
            schedule: schedule,
            created: new Date(),
            enabled: true
        };
        
        this.scheduledTasks.set(taskId, task);
        
        // Set up the scheduled execution
        this.setupScheduledExecution(task);
        
        return taskId;
    }

    setupScheduledExecution(task) {
        // This is a simplified implementation
        // In production, you'd use a proper scheduling library
        const interval = this.parseSchedule(task.schedule);
        
        if (interval > 0) {
            const timer = setInterval(async () => {
                if (task.enabled) {
                    await this.executeCommand(task.command);
                }
            }, interval);
            
            task.timer = timer;
        }
    }

    parseSchedule(schedule) {
        // Simple schedule parsing - supports basic intervals like "5m", "1h", "30s"
        const match = schedule.match(/^(\d+)([smhd])$/);
        if (!match) return 0;
        
        const value = parseInt(match[1]);
        const unit = match[2];
        
        switch (unit) {
            case 's': return value * 1000;
            case 'm': return value * 60 * 1000;
            case 'h': return value * 60 * 60 * 1000;
            case 'd': return value * 24 * 60 * 60 * 1000;
            default: return 0;
        }
    }

    cancelScheduledTask(taskId) {
        const task = this.scheduledTasks.get(taskId);
        if (task && task.timer) {
            clearInterval(task.timer);
            this.scheduledTasks.delete(taskId);
            return true;
        }
        return false;
    }

    getScheduledTasks() {
        return Array.from(this.scheduledTasks.values());
    }
    
    getStatus() {
        return {
            active: true,
            platform: this.platform,
            automationScripts: this.automationScripts.size,
            workflowTemplates: this.workflowTemplates.size,
            runningProcesses: this.runningProcesses.size,
            scheduledTasks: this.scheduledTasks.size,
            lockedCapabilities: this.lockedCapabilities
        };
    }

    destroy() {
        // Terminate all running processes
        for (const [pid, process] of this.runningProcesses) {
            try {
                process.kill();
            } catch (error) {
                console.error(`Failed to terminate process ${pid}:`, error);
            }
        }
        
        // Cancel all scheduled tasks
        for (const taskId of this.scheduledTasks.keys()) {
            this.cancelScheduledTask(taskId);
        }
        
        this.runningProcesses.clear();
        this.scheduledTasks.clear();
    }
}

module.exports = { TaskAutomationService };