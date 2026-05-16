(function () {
  'use strict';

  var installCommands = {
    default: 'npm install -g argus-ai-hub',
    ubuntu: 'sudo npm install -g argus-ai-hub'
  };

  // Platform tabs (handles all option blocks)
  document.querySelectorAll('.install-tabs').forEach(function (tablist) {
    var wrap = tablist.closest('.hero__install-wrap');
    var commandEl = wrap.querySelector('.install-command');
    var copyBtn = wrap.querySelector('.install-copy');

    tablist.querySelectorAll('.install-tab').forEach(function (tab) {
      tab.addEventListener('click', function () {
        tablist.querySelectorAll('.install-tab').forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        tab.classList.add('active');
        tab.setAttribute('aria-selected', 'true');

        var cmd = installCommands[tab.dataset.platform];
        if (commandEl) {
          commandEl.textContent = cmd;
        }
        if (copyBtn) {
          copyBtn.dataset.copy = cmd;
        }
      });
    });
  });

  // Auto-detect platform and set all tab groups
  var detectedPlatform = 'default';
  var ua = navigator.userAgent || navigator.platform || '';
  if (/Linux/.test(ua)) {
    detectedPlatform = 'ubuntu';
  }

  if (detectedPlatform !== 'default') {
    document.querySelectorAll('.install-tabs').forEach(function (tablist) {
      var wrap = tablist.closest('.hero__install-wrap');
      var commandEl = wrap.querySelector('.install-command');
      var copyBtn = wrap.querySelector('.install-copy');
      var targetTab = tablist.querySelector('[data-platform="' + detectedPlatform + '"]');

      if (targetTab) {
        tablist.querySelectorAll('.install-tab').forEach(function (t) {
          t.classList.remove('active');
          t.setAttribute('aria-selected', 'false');
        });
        targetTab.classList.add('active');
        targetTab.setAttribute('aria-selected', 'true');

        var cmd = installCommands[detectedPlatform];
        if (commandEl) {
          commandEl.textContent = cmd;
        }
        if (copyBtn) {
          copyBtn.dataset.copy = cmd;
        }
      }
    });
  }

  // Clipboard copy for all copy buttons
  document.querySelectorAll('.install-copy').forEach(function (btn) {
    if (navigator.clipboard) {
      btn.addEventListener('click', function () {
        var text = btn.dataset.copy;
        navigator.clipboard.writeText(text).then(function () {
          btn.classList.add('copied');
          setTimeout(function () {
            btn.classList.remove('copied');
          }, 2000);
        }).catch(function () {
          // Silently ignore clipboard errors
        });
      });
    }
  });

  // Badge error handler: hide parent element when a badge image fails to load
  document.querySelectorAll('.badge').forEach(function (img) {
    img.addEventListener('error', function () {
      var parent = img.parentElement;
      if (parent) {
        parent.style.display = 'none';
      }
    });
  });
}());
