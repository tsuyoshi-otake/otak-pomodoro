# Change Log

## [1.2.1] - 2025-03-01

### Updated
- Updated README.md documentation

## [1.2.0] - 2025-02-22

### Added
- Enhanced visual notifications with status bar background color flash effect
- Color utility functions for dynamic visual feedback
- Improved timer completion notifications with combined visual and audio feedback

## [1.1.0] - 2025-02-21

### Changed
- Removed total work time tracking feature for simpler UI
- Simplified tooltip display by removing accumulated work time

## [1.0.0] - 2025-02-21

### Fixed
- Total work time tracking now correctly accumulates actual work time
- Fixed work time calculation to use real session duration
- Removed global state dependency for better workspace isolation

## [0.0.2] - 2025-02-21

### Changed
- Updated progress tracking to show total work time instead of session count
- Added hours and minutes display format for accumulated work time
- Improved tooltip information with clearer time progress representation

## [0.0.1] - 2025-02-20

### Added
- Initial release of otak-pomodoro
- Focus timer with 25-minute default duration
- Break timer with 5-minute default duration
- Long breaks (15 minutes) after every 4 pomodoros
- Status bar integration with play/stop controls
- Markdown-formatted tooltip with settings access
- Sound notifications for timer completion
- Customizable timer durations via settings
- Session counter and progress tracking
- Command palette integration
- Real-time configuration updates
- Visual and audio notifications

### Technical Details
- VSCode native audioCues integration
- Configuration persistence
- State management for pomodoro sessions
- Real-time status bar updates
- Settings validation and error handling

### Developer Notes
- Implemented following .clinerules-code guidelines
- Part of the otak-series VSCode extensions
- Follows VSCode extension best practices