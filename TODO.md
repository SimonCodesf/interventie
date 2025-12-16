# Project Plan & Todo

## Phase 1: Critical Fixes & UI Polish (Mobile & Desktop)
Focus: Immediate visual bugs and usability issues.

- [ ] **Desktop**: Fix download count bug (currently concatenates strings instead of adding numbers).
- [ ] **Mobile/AR**: Adjust Camera feed position (center vertically between logo and bottom).
- [ ] **Mobile/AR**: Fix Gallery UI/Swipe up (style like desktop, fix overlap with logo).
- [ ] **Desktop**: Improve Log integration (make it stick to bottom/integrate better).
- [ ] **Desktop**: Fix Table header spacing.
- [ ] **General**: Translate and cleanup frontend logs (English -> Dutch, remove debug noise).
- [ ] **Mobile**: Remove "Play" button on AR video textures (likely autoplay policy issue).

## Phase 2: Admin Panel Overhaul & Security
Focus: Backend usability and data safety.

- [ ] **Admin**: Improve UI/UX to match Desktop "hacker" style.
- [ ] **Admin**: Fix Upload editing behavior (ensure consistency with upload).
- [ ] **Security**: Improve security (review auth, headers).
- [ ] **Analytics**: Add basic analytics with Cookie Consent (GDPR compliance).

## Phase 3: Advanced Features & AR Enhancements
Focus: New features and deeper AR integration.

- [ ] **AR**: Expand AR options (more interactive elements).
- [ ] **Desktop**: Implement "Random Tabs" on startup (Welcome, Instructions, Manifest, etc.).
- [ ] **Mobile**: Investigate Camera permission persistence (reduce permission prompts).

## Phase 4: Maintenance & DevOps
Focus: Code quality and deployment automation.

- [ ] **Cleanup**: Organize files (remove unused, better structure).
- [ ] **Backup**: Implement a backup system.
- [ ] **DevOps**: Setup Auto-upload to cPanel via GitHub Actions.
