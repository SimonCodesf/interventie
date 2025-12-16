# Project Plan & Todo

## Phase 1: Critical Fixes & UI Polish (Mobile & Desktop)
**Status**: IN PROGRESS
Focus: Immediate visual bugs and usability issues.

- [x] **Desktop**: Fix download count bug (currently concatenates strings instead of adding numbers).
- [x] **Mobile/AR**: Adjust Camera feed position (center vertically between logo and bottom).
- [x] **Mobile/AR**: Fix Gallery UI/Swipe up (style like desktop, fix overlap with logo).
- [ ] **Desktop**: Improve Log integration (make it stick to bottom/integrate better).
- [ ] **Desktop**: Fix Table header spacing.
- [ ] **General**: Translate and cleanup frontend logs (English -> Dutch, remove debug noise).
- [ ] **Mobile**: Remove "Play" button on AR video textures (likely autoplay policy issue).

## Phase 2: Admin Panel Overhaul & Security
**Status**: NOT STARTED
Focus: Backend usability and data safety.

- [ ] **Admin**: Improve UI/UX to match Desktop "hacker" style.
- [ ] **Admin**: Fix Upload editing behavior (ensure consistency with upload).
- [ ] **Security**: Improve security (review auth, headers).
- [ ] **Analytics**: Add basic analytics with Cookie Consent (GDPR compliance).

## Phase 3: Advanced Features & AR Enhancements
**Status**: NOT STARTED
Focus: New features and deeper AR integration.

- [ ] **AR**: Expand AR options (more interactive elements).
- [ ] **Desktop**: Implement "Random Tabs" on startup (Welcome, Instructions, Manifest, etc.).
- [ ] **Mobile**: Investigate Camera permission persistence (reduce permission prompts).

## Phase 4: Maintenance & DevOps
**Status**: COMPLETED
Focus: Code quality and deployment automation.

- [x] **Cleanup**: Organize files (remove unused, better structure).
- [x] **Backup**: Implement a backup system.
- [x] **DevOps**: Setup Auto-upload to cPanel via GitHub Actions (using FTP-Deploy-Action).
- [x] **AR System**: Fixed Node.js integration for automatic .mind file generation.
- [x] **Documentation**: Updated copilot-instructions.md with server setup and troubleshooting.
