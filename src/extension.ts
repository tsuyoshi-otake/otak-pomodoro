import * as vscode from 'vscode';

class PomodoroTimer {
    private statusBarItem: vscode.StatusBarItem;
    private timer: NodeJS.Timeout | undefined;
    private timeRemaining: number;
    private isBreak: boolean;
    private isPaused: boolean;
    private pomodoroCount: number;
    private config: vscode.WorkspaceConfiguration;

    constructor() {
        this.statusBarItem = vscode.window.createStatusBarItem(
            vscode.StatusBarAlignment.Left,
            0
        );
        this.config = vscode.workspace.getConfiguration('otakPomodoro');
        this.timeRemaining = this.getWorkTime();
        this.isBreak = false;
        this.isPaused = true;
        this.pomodoroCount = 0;
        this.updateStatusBar();
        this.statusBarItem.show();

        // Configuration change event listener
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('otakPomodoro')) {
                this.config = vscode.workspace.getConfiguration('otakPomodoro');
                if (this.isPaused) {
                    this.timeRemaining = this.isBreak ? this.getBreakTime() : this.getWorkTime();
                }
                this.updateStatusBar();
            }
        });
    }

    private getWorkTime(): number {
        return this.config.get<number>('workTime', 25) * 60;
    }

    private getBreakTime(): number {
        if (this.pomodoroCount > 0 && this.pomodoroCount % 4 === 0) {
            return this.config.get<number>('longBreakTime', 15) * 60;
        }
        return this.config.get<number>('breakTime', 5) * 60;
    }

    private playNotificationSound() {
        if (this.config.get<boolean>('soundEnabled', true)) {
            // Play notification sound
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: 'Timer Complete',
            }, async () => {
                // Play sound three times with a short delay
                for (let i = 0; i < 3; i++) {
                    await vscode.commands.executeCommand('audioCues.playSound', 'notification');
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            });
        }
    }

    private updateStatusBar() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const pomodoroStatus = `#${this.pomodoroCount + 1}`;
        
        const icon = this.isPaused ? '$(play)' : '$(debug-stop)';
        
        this.statusBarItem.text = `${icon} ${this.isBreak ? 'Break' : 'Focus'} ${timeString} ${pomodoroStatus}`;
        
        // Markdown formatted tooltip
        const tooltipLines = [
            `Pomodoro Timer`,
            '---',
            `Work Time: ${this.config.get('workTime')} min`,
            `Break Time: ${this.config.get('breakTime')} min`,
            `Long Break: ${this.config.get('longBreakTime')} min`,
            `Sound Notifications: ${this.config.get('soundEnabled') ? 'Enabled' : 'Disabled'}`,
            `Completed Pomodoros: ${this.pomodoroCount}`,
            `---`,
            `$(gear) [Open Settings](command:workbench.action.openSettings?%22otakPomodoro%22)`
        ];
        
        this.statusBarItem.tooltip = new vscode.MarkdownString(tooltipLines.join('\n'), true);
        this.statusBarItem.tooltip.isTrusted = true;
        this.statusBarItem.command = 'otak-pomodoro.toggleTimer';
    }

    toggleTimer() {
        if (this.isPaused) {
            this.startTimer();
        } else {
            this.pauseTimer();
        }
    }

    private startTimer() {
        this.isPaused = false;
        this.updateStatusBar();

        this.timer = setInterval(() => {
            this.timeRemaining--;

            if (this.timeRemaining <= 0) {
                if (!this.isBreak) {
                    this.pomodoroCount++;
                }
                this.switchMode();
                const isLongBreak = this.isBreak && this.pomodoroCount % 4 === 0;
                
                // Play notification sound
                this.playNotificationSound();
                
                vscode.window.showInformationMessage(
                    this.isBreak 
                        ? `Time for a ${isLongBreak ? 'long break' : 'break'}! (Pomodoro #${this.pomodoroCount} completed)`
                        : 'Time to focus!'
                );
            }

            this.updateStatusBar();
        }, 1000);
    }

    private pauseTimer() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = undefined;
        }
        this.isPaused = true;
        this.updateStatusBar();
    }

    reset() {
        this.pauseTimer();
        this.timeRemaining = this.getWorkTime();
        this.isBreak = false;
        this.pomodoroCount = 0;
        this.updateStatusBar();
    }

    private switchMode() {
        this.isBreak = !this.isBreak;
        this.timeRemaining = this.isBreak ? this.getBreakTime() : this.getWorkTime();
    }

    dispose() {
        if (this.timer) {
            clearInterval(this.timer);
        }
        this.statusBarItem.dispose();
    }
}

export function activate(context: vscode.ExtensionContext) {
    console.log('Pomodoro Timer extension is now active!');

    const pomodoroTimer = new PomodoroTimer();

    let toggleTimer = vscode.commands.registerCommand('otak-pomodoro.toggleTimer', () => {
        pomodoroTimer.toggleTimer();
    });

    let resetTimer = vscode.commands.registerCommand('otak-pomodoro.resetTimer', () => {
        pomodoroTimer.reset();
        vscode.window.showInformationMessage('Pomodoro Timer has been reset');
    });

    context.subscriptions.push(toggleTimer);
    context.subscriptions.push(resetTimer);
    context.subscriptions.push(pomodoroTimer);
}

export function deactivate() {}
