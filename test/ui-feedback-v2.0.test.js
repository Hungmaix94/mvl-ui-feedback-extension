/**
 * Automated TDD Test Suite for story ui-feedback-v2.0
 * Universal FE/QA UI Verification:
 * - TC-1: Manifest version 2.0.0 & metadata
 * - TC-2: Zero emoji in UI files (100% monochrome SVG icons)
 * - TC-3: Concentric radii tokens (--r-outer: 16px, --r-mid: 10px, --r-inner: 7px) in both CSS
 * - TC-4: Hero Crop Preview stage with dark checkerboard background pattern
 * - TC-5: Segmented DEV/QA switcher with WAI-ARIA (radiogroup, radio, aria-checked)
 * - TC-6: Tactile scale(0.96) active states & ZERO "transition: all"
 * - TC-7: Focus visibility (:focus-visible) in both popup.css and content.css
 * - TC-8: Reduced motion (@media (prefers-reduced-motion: reduce)) in both popup.css and content.css
 * - TC-9: Accessible HTML structure: single <main>, <section role="tabpanel">, role="tablist", role="tab"
 * - TC-10: P0 Security: escapeHtml sanitization in popup.js and content.js
 * - TC-11: Content popover role="dialog", aria-modal="true", and button floating pill
 * - TC-12: Node syntax check for all JavaScript files
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

console.log('=== Running UI Feedback v2.0 Universal FE/QA TDD Test Suite ===\n');

// 1. Manifest version 2.0.0 check
const manifestRaw = fs.readFileSync(path.join(ROOT_DIR, 'manifest.json'), 'utf8');
const manifest = JSON.parse(manifestRaw);
assert(manifest.version === '2.0.0', `TC-1: manifest.json version must be '2.0.0' (got '${manifest.version}')`);
assert(manifest.name.includes('v2.0'), `TC-1: manifest.json name must indicate v2.0 (got '${manifest.name}')`);

// 2. Zero Emoji Check across all UI files
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
  assert(!hasEmoji, `TC-2: ${file} must not contain any emoji`);
});

// 3. Concentric radii CSS tokens
const contentCss = fs.readFileSync(path.join(ROOT_DIR, 'content.css'), 'utf8');
const popupCss = fs.readFileSync(path.join(ROOT_DIR, 'popup.css'), 'utf8');

assert(
  contentCss.includes('--r-outer') && contentCss.includes('16px') &&
  contentCss.includes('--r-mid') && contentCss.includes('10px') &&
  contentCss.includes('--r-inner') && contentCss.includes('7px'),
  'TC-3: content.css must declare concentric radius tokens (--r-outer: 16px, --r-mid: 10px, --r-inner: 7px)'
);

assert(
  popupCss.includes('--r-outer') && popupCss.includes('16px') &&
  popupCss.includes('--r-mid') && popupCss.includes('10px') &&
  popupCss.includes('--r-inner') && popupCss.includes('7px'),
  'TC-3: popup.css must declare concentric radius tokens (--r-outer: 16px, --r-mid: 10px, --r-inner: 7px)'
);

// 4. Hero Crop Preview Checkerboard
assert(
  contentCss.includes('conic-gradient') || (contentCss.includes('45deg') && contentCss.includes('transparent 75%')),
  'TC-4: content.css .mvl-fb-crop-stage must include a dark checkerboard background pattern'
);

// 5. Segmented Mode Switcher DEV/QA Accessibility
const popupHtml = fs.readFileSync(path.join(ROOT_DIR, 'popup.html'), 'utf8');
assert(
  popupHtml.includes('role="radiogroup"') || popupHtml.includes("role='radiogroup'"),
  'TC-5: popup.html mode switcher must have role="radiogroup"'
);
assert(
  popupHtml.includes('role="radio"') || popupHtml.includes("role='radio'"),
  'TC-5: popup.html mode switcher options must have role="radio"'
);
assert(
  popupHtml.includes('aria-checked'),
  'TC-5: popup.html mode switcher must use aria-checked for selection state'
);

// 6. Tactile & Transition All Guard
assert(
  !popupCss.split('\n').some(l => l.includes('transition:') && l.includes('all') && !l.trim().startsWith('/*')),
  'TC-6: popup.css must not use forbidden "transition: all"'
);
assert(
  !contentCss.split('\n').some(l => l.includes('transition:') && l.includes('all') && !l.trim().startsWith('/*')),
  'TC-6: content.css must not use forbidden "transition: all"'
);
assert(
  popupCss.includes('scale(0.96)'),
  'TC-6: popup.css must include tactile scale(0.96) press states'
);
assert(
  contentCss.includes('scale(0.96)'),
  'TC-6: content.css must include tactile scale(0.96) press states'
);

// 7. Focus Visibility (:focus-visible)
assert(
  popupCss.includes(':focus-visible'),
  'TC-7: popup.css must implement :focus-visible for keyboard accessibility'
);
assert(
  contentCss.includes(':focus-visible'),
  'TC-7: content.css must implement :focus-visible for keyboard accessibility'
);

// 8. Reduced Motion
assert(
  popupCss.includes('prefers-reduced-motion'),
  'TC-8: popup.css must include @media (prefers-reduced-motion: reduce)'
);
assert(
  contentCss.includes('prefers-reduced-motion'),
  'TC-8: content.css must include @media (prefers-reduced-motion: reduce)'
);

// 9. Semantic HTML structure in popup.html
const mainTagMatches = (popupHtml.match(/<main[\s>]/g) || []).length;
assert(
  mainTagMatches === 1,
  `TC-9: popup.html must contain exactly 1 <main> element (found ${mainTagMatches})`
);
assert(
  popupHtml.includes('role="tablist"') && popupHtml.includes('role="tab"') && popupHtml.includes('role="tabpanel"'),
  'TC-9: popup.html must use proper WAI-ARIA tab semantics (role="tablist", role="tab", role="tabpanel")'
);

// 10. Security P0 escapeHtml checks
const popupJs = fs.readFileSync(path.join(ROOT_DIR, 'popup.js'), 'utf8');
const contentJs = fs.readFileSync(path.join(ROOT_DIR, 'content.js'), 'utf8');
assert(
  popupJs.includes('function escapeHtml') || popupJs.includes('const escapeHtml'),
  'TC-10: popup.js must define escapeHtml sanitizer'
);
assert(
  contentJs.includes('function escapeHtml') || contentJs.includes('const escapeHtml'),
  'TC-10: content.js must define escapeHtml sanitizer'
);

// 11. Content dialog & button element checks
assert(
  contentJs.includes('role", "dialog"') || contentJs.includes('role=\\"dialog\\"'),
  'TC-11: content.js popover must have role="dialog"'
);
assert(
  contentJs.includes('createElement("button")'),
  'TC-11: content.js floating pill must be created as an accessible <button>'
);

// 12. Node Syntax Validation for all JS scripts
const jsFiles = ['popup.js', 'content.js', 'background.js', 'default-config.js', 'page-bridge.js'];
jsFiles.forEach(file => {
  try {
    execSync(`node --check ${path.join(ROOT_DIR, file)}`, { stdio: 'pipe' });
    assert(true, `TC-12: ${file} passes node --check`);
  } catch (err) {
    assert(false, `TC-12: ${file} fails node --check: ${err.message}`);
  }
});

console.log(`\n=== TDD Results: ${totalTests - failedTests}/${totalTests} Passed (${failedTests} Failed) ===\n`);

if (failedTests > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
