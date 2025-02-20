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

    private updateStatusBar() {
        const minutes = Math.floor(this.timeRemaining / 60);
        const seconds = this.timeRemaining % 60;
        const timeString = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        const pomodoroStatus = `#${this.pomodoroCount + 1}`;

        const icon = this.isPaused ? '$(play)' : '$(debug-stop)';

        this.statusBarItem.text = `${icon} ${this.isBreak ? 'Break' : 'Focus'} ${timeString} ${pomodoroStatus}`;

        const tooltip = new vscode.MarkdownString();
        tooltip.isTrusted = true;
        tooltip.supportThemeIcons = true;

        // Main title section
        tooltip.appendMarkdown('Pomodoro Timer\n\n');
        tooltip.appendMarkdown(`Progress: ${this.pomodoroCount} sessions\n\n`);

        // Action buttons
        tooltip.appendMarkdown('---\n');
        tooltip.appendMarkdown(`$(debug-continue) [Skip](command:otak-pomodoro.skipTimer "Skip current session")\n\n`);
        tooltip.appendMarkdown(`$(refresh) [Reset](command:otak-pomodoro.resetTimer "Reset timer and count")\n\n`);
        tooltip.appendMarkdown(`$(settings-gear) [Settings](command:workbench.action.openSettings?%22otakPomodoro%22 "Open Pomodoro settings")`);

        this.statusBarItem.tooltip = tooltip;
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

                const message = this.isBreak
                    ? `Time for a ${isLongBreak ? 'long break' : 'break'}! (Pomodoro #${this.pomodoroCount} completed)`
                    : 'Time to focus!'
                    ;
                void vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: message,
                    cancellable: false
                }, () => new Promise(resolve => setTimeout(resolve, 8000)));
            }

            this.updateStatusBar();
        }, 1000);
    }

    private playNotificationSound() {
        if (this.config.get<boolean>('soundEnabled', true)) {
            vscode.window.withProgress({
                location: vscode.ProgressLocation.Window,
                title: 'Timer Complete'
            }, async () => {
                for (let i = 0; i < 3; i++) {
                    try {
                        // Play notification sound using built-in notification sound
                        await vscode.commands.executeCommand('editor.action.playAudioCue', 'notification');
                        await new Promise(resolve => setTimeout(resolve, 500));
                    } catch (error) {
                        console.error('Failed to play sound:', error);
                    }
                }
            });
        }
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

    skipSession() {
        this.pauseTimer();
        this.switchMode();
        this.updateStatusBar();
        const message = `Skipped to ${this.isBreak ? 'break' : 'focus'} session`;
        void vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: message,
            cancellable: false
        }, () => new Promise(resolve => setTimeout(resolve, 3000)));
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
        void vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Pomodoro Timer has been reset',
            cancellable: false
        }, () => new Promise(resolve => setTimeout(resolve, 3000)));
    });

    let skipTimer = vscode.commands.registerCommand('otak-pomodoro.skipTimer', () => {
        pomodoroTimer.skipSession();
    });

    context.subscriptions.push(toggleTimer);
    context.subscriptions.push(resetTimer);
    context.subscriptions.push(pomodoroTimer);
    context.subscriptions.push(skipTimer);
}

export function deactivate() { }
