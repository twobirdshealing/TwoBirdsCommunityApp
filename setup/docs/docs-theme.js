/**
 * TBC Docs — Unified Theme JS
 *
 * Auto-injects:
 *   1. Sticky top bar (title, back link, theme toggle)
 *   2. Section nav from TOC (if present)
 *   3. Wraps body content in .guide-content
 *   4. Lightbox for .step-img images
 *
 * Theme: detects system preference, remembers user choice.
 */

/* --- Apply theme BEFORE paint to prevent flash --- */
(function() {
  var s = localStorage.getItem('tbc-docs-theme');
  if (!s) s = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  if (s === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
})();

/* --- Ionicons (loaded as ES module with nomodule fallback) --- */
(function() {
  var esm = document.createElement('script');
  esm.type = 'module';
  esm.src = 'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js';
  document.head.appendChild(esm);

  var nomod = document.createElement('script');
  nomod.noModule = true;
  nomod.src = 'https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.js';
  document.head.appendChild(nomod);
})();

/* --- Main init on DOMContentLoaded --- */
(function() {
  function init() {
    // Detect if we're in a subdirectory (modules/)
    var isSubdir = /\/modules\//.test(window.location.pathname) ||
                   document.querySelector('link[href*="../docs-theme"]') !== null;
    var basePath = isSubdir ? '../' : '';

    // --- Build top bar ---
    var pageTitle = document.title.replace(/^Community App\s*[—–-]\s*/, '').trim();
    var title = 'TBC Community App \u2014 ' + pageTitle;
    var isIndex = /\/index\.html$/.test(window.location.pathname) ||
                  /\/docs\/?$/.test(window.location.pathname);
    var topBar = document.createElement('div');
    topBar.className = 'top-bar';
    topBar.innerHTML =
      (isIndex ? '' :
        '<a class="top-bar-back" href="' + basePath + 'index.html">' +
          '<ion-icon name="arrow-back-outline" style="font-size:14px"></ion-icon> All Docs' +
        '</a>') +
      '<span class="top-bar-title">' + escapeHtml(title) + '</span>' +
      '<div class="top-bar-right">' +
        '<span class="top-bar-badge">Docs</span>' +
        '<button class="theme-toggle" id="theme-toggle" title="Toggle light/dark mode"></button>' +
      '</div>';

    // --- Build section nav from TOC (if present), then hide inline TOC ---
    var toc = document.querySelector('.toc');
    var sectionNav = null;
    if (toc) {
      var tocLinks = toc.querySelectorAll('a[href^="#"]');
      if (tocLinks.length > 0) {
        sectionNav = document.createElement('div');
        sectionNav.className = 'section-nav';
        sectionNav.id = 'section-nav';
        for (var i = 0; i < tocLinks.length; i++) {
          var a = document.createElement('a');
          a.href = tocLinks[i].getAttribute('href');
          a.textContent = tocLinks[i].textContent;
          sectionNav.appendChild(a);
        }
        toc.style.display = 'none';
      }
    }

    // --- Wrap body content in .guide-content ---
    var wrapper = document.createElement('div');
    wrapper.className = 'guide-content';

    // Remove old .docs-nav breadcrumb if present
    var oldNav = document.querySelector('.docs-nav');
    if (oldNav) oldNav.remove();

    // Remove old .docs-theme-toggle if present
    var oldToggle = document.querySelector('.docs-theme-toggle');
    if (oldToggle) oldToggle.remove();

    // Move all body children into wrapper
    while (document.body.firstChild) {
      wrapper.appendChild(document.body.firstChild);
    }

    // Insert top bar, section nav, then wrapper
    document.body.appendChild(topBar);
    if (sectionNav) document.body.appendChild(sectionNav);
    document.body.appendChild(wrapper);

    // --- Theme toggle ---
    var toggleBtn = document.getElementById('theme-toggle');
    var isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    toggleBtn.textContent = isDark ? '\u263E' : '\u2600';
    toggleBtn.addEventListener('click', function() {
      var current = document.documentElement.getAttribute('data-theme') === 'dark';
      if (current) {
        document.documentElement.removeAttribute('data-theme');
        localStorage.setItem('tbc-docs-theme', 'light');
        toggleBtn.textContent = '\u2600';
      } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('tbc-docs-theme', 'dark');
        toggleBtn.textContent = '\u263E';
      }
    });

    // --- Section nav scroll spy ---
    if (sectionNav) {
      var navLinks = sectionNav.querySelectorAll('a');
      var sectionIds = [];
      for (var j = 0; j < navLinks.length; j++) {
        sectionIds.push(navLinks[j].getAttribute('href').replace('#', ''));
      }

      // Smooth scroll on nav click
      navLinks.forEach(function(link) {
        link.addEventListener('click', function(e) {
          e.preventDefault();
          var targetId = this.getAttribute('href').replace('#', '');
          var target = document.getElementById(targetId);
          if (target) {
            var offset = topBar.offsetHeight + (sectionNav ? sectionNav.offsetHeight : 0) + 16;
            var top = target.getBoundingClientRect().top + window.pageYOffset - offset;
            window.scrollTo({ top: top, behavior: 'smooth' });
          }
        });
      });

      // Highlight active section on scroll
      var ticking = false;
      window.addEventListener('scroll', function() {
        if (!ticking) {
          requestAnimationFrame(function() {
            var scrollPos = window.pageYOffset + topBar.offsetHeight + sectionNav.offsetHeight + 40;
            var activeId = sectionIds[0];
            for (var k = 0; k < sectionIds.length; k++) {
              var el = document.getElementById(sectionIds[k]);
              if (el && el.offsetTop <= scrollPos) {
                activeId = sectionIds[k];
              }
            }
            navLinks.forEach(function(a) {
              a.classList.toggle('active', a.getAttribute('href') === '#' + activeId);
            });
            ticking = false;
          });
          ticking = true;
        }
      });

      // Set initial active
      if (navLinks.length > 0) navLinks[0].classList.add('active');
    }

    // --- Lightbox for .step-img ---
    var imgs = document.querySelectorAll('.step-img');
    if (imgs.length > 0) {
      var lb = document.createElement('div');
      lb.className = 'lightbox-overlay';
      lb.setAttribute('role', 'dialog');
      lb.setAttribute('aria-modal', 'true');
      lb.setAttribute('tabindex', '-1');
      lb.innerHTML = '<img alt="">';
      lb.addEventListener('click', function() { lb.classList.remove('active'); });
      document.body.appendChild(lb);
      var lbImg = lb.querySelector('img');
      imgs.forEach(function(img) {
        img.addEventListener('click', function() {
          lbImg.src = this.src;
          lbImg.alt = this.alt;
          lb.classList.add('active');
          lb.focus();
        });
      });
      document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape') lb.classList.remove('active');
      });
    }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
