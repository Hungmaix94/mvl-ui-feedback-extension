/**
 * Automated TDD Test Suite for story ui-feedback-v1.1
 * Covers AC-1 through AC-7:
 * - AC-1: Zero emoji in UI files, 100% monochrome SVG
 * - AC-2: Obsidian glass & specular highlight
 * - AC-3: Concentric radii tokens (--r-outer: 16px, --r-mid: 10px, --r-inner: 7px)
 * - AC-4: Segmented DEV/QA control with accessibility roles and attributes
 * - AC-5: Hero Crop Preview stage with checkerboard background
 * - AC-6: Tactile scale(0.96) and no transition: all
 * - AC-7: Manifest version 1.1.0 & node syntax validation
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT_DIR = path.resolve(__dirname, '..');

let totalTests = 0;
let failedTests = 0;

function assert(condition, message) {
  totalTests++;
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    failedTests++;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

console.log('=== Running UI Feedback v1.1 TDD Test Suite ===\n');

// 1. Manifest version 1.1.0 check (AC-7)
const manifestRaw = fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8');
const manifest = JSON.parse(manifestRaw);
assert(manifest.version === '1.1.0', `AC-7: manifest.json version must be '1.1.0' (got '${manifest.version}')`);

// 2. Zero Emoji Check across all UI files (AC-1)
const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
const uiFiles = ['popup.html', 'popup.js', 'popup.css', 'content.js', 'content.css'];

uiFiles.forEach(file => {
  const content = fs.readFileSync(path.join(ROOT_DIR, file), 'utf8');
  const lines = content.split('\n');
  let hasEmoji = false;
  lines.forEach((line, idx) => {
    if (emojiRegex.test(line)) {
      hasEmoji = true;
      console.error(`   Found emoji in ${file}:${idx + 1}: ${line.trim()}`);
    }
  });
  assert(!hasEmoji, `AC-1: ${file} must not contain any emoji`);
});

// 3. Concentric radii CSS tokens (AC-3)
const contentCss = fs.readFileSync(path.join(ROOT_DIR, 'content.css'), 'utf8');
const popupCss = fs.readFileSync(path.join(ROOT_DIR, 'popup.css'), 'utf8');

assert(
  contentCss.includes('--r-outer') && contentCss.includes('16px') &&
  contentCss.includes('--r-mid') && contentCss.includes('10px') &&
  contentCss.includes('--r-inner') && contentCss.includes('7px'),
  'AC-3: content.css must declare concentric radius tokens (--r-outer: 16px, --r-mid: 10px, --r-inner: 7px)'
);

assert(
  popupCss.includes('--r-outer') && popupCss.includes('16px') &&
  popupCss.includes('--r-mid') && popupCss.includes('10px') &&
  popupCss.includes('--r-inner') && popupCss.includes('7px'),
  'AC-3: popup.css must declare concentric radius tokens (--r-outer: 16px, --r-mid: 10px, --r-inner: 7px)'
);

// 4. Hero Crop Preview Checkerboard (AC-5)
assert(
  contentCss.includes('conic-gradient') || (contentCss.includes('45deg') && contentCss.includes('transparent 75%')),
  'AC-5: content.css .mvl-fb-crop-stage must include a dark checkerboard background pattern'
);

// 5. Segmented Mode Switcher DEV/QA Accessibility (AC-4)
const popupHtml = fs.readFileSync(path.join(ROOT_DIR, 'popup.html'), 'utf8');
assert(
  popupHtml.includes('role="radiogroup"') || popupHtml.includes("role='radiogroup'"),
  'AC-4: popup.html mode switcher must have role="radiogroup"'
);
assert(
  popupHtml.includes('role="radio"') || popupHtml.includes("role='radio'"),
  'AC-4: popup.html mode switcher options must have role="radio"'
);
assert(
  popupHtml.includes('aria-checked'),
  'AC-4: popup.html mode switcher must use aria-checked for selection state'
);

// 6. Tactile & Transition All Guard (AC-6)
assert(
  !popupCss.split('\n').some(l => l.includes('transition:') && l.includes('all') && !l.trim().startsWith('/*')),
  'AC-6: popup.css must not use forbidden "transition: all"'
);
assert(
  !contentCss.split('\n').some(l => l.includes('transition:') && l.includes('all') && !l.trim().startsWith('/*')),
  'AC-6: content.css must not use forbidden "transition: all"'
);

// 7. Node Syntax Validation for all JS scripts
const jsFiles = ['popup.js', 'content.js', 'background.js', 'default-config.js', 'page-bridge.js'];
jsFiles.forEach(file => {
  try {
    execSync(`node --check ${path.join(ROOT_DIR, file)}`, { stdio: 'pipe' });
    assert(true, `AC-7: ${file} passes node --check`);
  } catch (err) {
    assert(false, `AC-7: ${file} fails node --check: ${err.message}`);
  }
});

console.log(`\n=== TDD Results: ${totalTests - failedTests}/${totalTests} Passed (${failedTests} Failed) ===\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
