import * as vscode from 'vscode';

/**
 * ヘルパー関数：16進数カラー文字列を RGB オブジェクトに変換
 */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    hex = hex.replace(/^#/, '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    if (hex.length !== 6) {
        return null;
    }
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return { r, g, b };
}

/**
 * RGB オブジェクトを 16 進数カラー文字列に変換
 */
function rgbToHex(r: number, g: number, b: number): string {
    return '#' + [r, g, b]
        .map(c => c.toString(16).padStart(2, '0'))
        .join('');
}

/**
 * RGB を HSL に変換  
 * r, g, b の範囲は 0～255, 戻り値 h は 0～360, s, l は 0～1 の値
 */
function rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    r /= 255;
    g /= 255;
    b /= 255;
    
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const l = (max + min) / 2;
    let h = 0, s = 0;
    
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r:
                h = ((g - b) / d + (g < b ? 6 : 0));
                break;
            case g:
                h = ((b - r) / d + 2);
                break;
            case b:
                h = ((r - g) / d + 4);
                break;
        }
        h *= 60;
    }
    return { h, s, l };
}

/**
 * HSL を RGB に変換  
 * h の範囲は 0～360, s, l は 0～1, 戻り値 r, g, b は 0～255
 */
function hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    let r: number, g: number, b: number;

    if (s === 0) {
        r = g = b = l * 255; // グレースケール
    } else {
        const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : (l + s - l * s);
        const p = 2 * l - q;
        r = hue2rgb(p, q, (h / 360) + 1/3) * 255;
        g = hue2rgb(p, q, h / 360) * 255;
        b = hue2rgb(p, q, (h / 360) - 1/3) * 255;
    }
    return { r: Math.round(r), g: Math.round(g), b: Math.round(b) };
}

/**
 * 補色（色相180°反転）を計算する関数
 */
function invertColor(hex: string): string {
    const rgb = hexToRgb(hex);
    if (!rgb) {
        return hex;
    }
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
    hsl.h = (hsl.h + 180) % 360;
    const newRgb = hslToRgb(hsl.h, hsl.s, hsl.l);
    return rgbToHex(newRgb.r, newRgb.g, newRgb.b);
}

/**
 * ステータスバーの背景色を補色に変更し、元に戻す処理を指定回数（デフォルト3回）実行する関数  
 * プロキシオブジェクト操作で delete を避けるため、新規オブジェクトに置き換えます。
 */
function flashStatusBar(repeatCount: number = 3): void {
    if (repeatCount <= 0) {
        return;
    }

    const workbenchConfig = vscode.workspace.getConfiguration('workbench');

    // 現在のカスタマイズ設定を取得し、"statusBar.background"を除外した新オブジェクトを生成
    let customizations = (workbenchConfig.get('colorCustomizations') as { [key: string]: any }) || {};
    const { ["statusBar.background"]: omit, ...baseCustomizations } = customizations;

    // 一度クリーンな状態に更新
    workbenchConfig
        .update('colorCustomizations', baseCustomizations, vscode.ConfigurationTarget.Global)
        .then(() => {
            // VS Codeのデフォルト値を基準（ユーザーの好みに応じて変更可）
            const defaultStatusBarBg = "#007ACC";
            const invertedColor = invertColor(defaultStatusBarBg);

            // 反転色を設定
            const flashCustomizations = { ...baseCustomizations, "statusBar.background": invertedColor };
            workbenchConfig
                .update('colorCustomizations', flashCustomizations, vscode.ConfigurationTarget.Global)
                .then(() => {
                    // 500ms後に元の状態に戻し、その後再度反転処理を呼び出す
                    setTimeout(() => {
                        workbenchConfig
                            .update('colorCustomizations', baseCustomizations, vscode.ConfigurationTarget.Global)
                            .then(() => {
                                // 次の反転へ（repeatCountをデクリメント）
                                flashStatusBar(repeatCount - 1);
                            });
                    }, 500);
                });
        });
}

//
// 以下はPomodoroTimerクラスなど既存のコードです。必要に応じて利用してください。
//

class PomodoroTimer {
    private statusBarItem: vscode.StatusBarItem;
    private timer: NodeJS.Timeout | undefined;
    private timeRemaining: number;
    private isBreak: boolean;
    private isPaused: boolean;
    private pomodoroCount: number;
    private context: vscode.ExtensionContext;
    private config: vscode.WorkspaceConfiguration;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
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

        // 起動時に余分な "statusBar.background" 設定があれば除外した状態で更新
        const workbenchConfig = vscode.workspace.getConfiguration('workbench');
        let currentCustomizations = (workbenchConfig.get('colorCustomizations') as { [key: string]: any }) || {};
        const { ["statusBar.background"]: omit, ...cleanedCustomizations } = currentCustomizations;
        workbenchConfig.update('colorCustomizations', cleanedCustomizations, vscode.ConfigurationTarget.Global);

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
        tooltip.appendMarkdown('Pomodoro Timer\n\n');
        tooltip.appendMarkdown('---\n');
        tooltip.appendMarkdown(`$(debug-continue) [Skip](command:otak-pomodoro.skipTimer "Skip current session") &nbsp;&nbsp; $(refresh) [Reset](command:otak-pomodoro.resetTimer "Reset timer and count")\n\n`);
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
                // タイマー終了時に3回背景色を反転させる
                flashStatusBar(3);

                if (!this.isBreak) {
                    this.pomodoroCount++;
                }
                this.switchMode();
                const isLongBreak = this.isBreak && this.pomodoroCount % 4 === 0;

                this.playNotificationSound();

                const message = this.isBreak
                    ? `Time for a ${isLongBreak ? 'long break' : 'break'}! (Pomodoro #${this.pomodoroCount} completed)`
                    : 'Time to focus!';
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
        this.startTimer();
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

    const pomodoroTimer = new PomodoroTimer(context);

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