document.addEventListener('DOMContentLoaded', function () {

/* ==========================================================================
     SHARED HELPERS
     ========================================================================== */

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Run a callback once, the first time an element scrolls into view
  function onVisible(el, callback, threshold = 0.25) {
    if (!el) return;
    new IntersectionObserver(([entry], obs) => {
      if (entry.isIntersecting) {
        obs.disconnect();
        callback(el);
      }
    }, { threshold }).observe(el);
  }

  // Decode effect: text resolves left to right over `duration` ms.
  // wave = null -> everything after the reveal point is scrambled (short labels)
  // wave = N    -> only an N-character band ahead of the reveal point is scrambled,
  //                so long paragraphs stay readable and don't jump around
  const glyphs = '!<>-_\\/[]{}=+*^?#01';
  const randGlyph = () => glyphs[Math.floor(Math.random() * glyphs.length)];

  function decode(el, original, duration, wave = null) {
    if (!el || reduceMotion) return;
    clearInterval(el._decodeTimer);
    const start = performance.now();
    el._decodeTimer = setInterval(() => {
      const progress = Math.min((performance.now() - start) / duration, 1);
      const revealed = Math.floor(progress * original.length);
      el.textContent = original.split('').map((ch, i) => {
        if (ch === ' ' || i < revealed) return ch;
        if (wave !== null && i >= revealed + wave) return ch;
        return randGlyph();
      }).join('');
      if (progress >= 1) {
        clearInterval(el._decodeTimer);
        el.textContent = original;
      }
    }, 30);
  }

  // Keep the real text available to screen readers while it scrambles.
  // Headings can carry an aria-label. Other elements (p, span, strong) aren't
  // allowed one, so hide the animated text and add a screen-reader-only copy.
  function srText(el, text) {
    if (/^H[1-6]$/.test(el.tagName)) {
      el.setAttribute('aria-label', text);
      return;
    }
    el.setAttribute('aria-hidden', 'true');
    const sr = document.createElement('span');
    sr.className = 'sr-only';
    sr.textContent = text;
    el.after(sr);
  }

  function textOf(el) {
    const text = el.textContent.trim().replace(/\s+/g, ' ');
    srText(el, text);
    return text;
  }

  /* ==========================================================================
     SECTION HEADINGS
     "// LABEL" types out with a cursor, then the title decodes underneath
     ========================================================================== */

  const headingPairs = [
    ['.section-heading, .about-header', '.section-label', '.section-title'],
    ['.pricing__header', '.pricing__eyebrow', '.pricing__heading']
  ];

  headingPairs.forEach(([wrapSel, labelSel, titleSel]) => {
    document.querySelectorAll(wrapSel).forEach(wrap => {
      const label = wrap.querySelector(labelSel);
      const title = wrap.querySelector(titleSel);
      if (!label) return;

      const labelText = textOf(label);
      const titleText = title ? textOf(title) : '';
      label.classList.add('heading-label');
      if (title) title.classList.add('heading-title');

      if (reduceMotion) return;

      // Typed part + invisible remainder, so centered labels don't shift while typing
      label.innerHTML = '<span class="heading-typed"></span><span class="heading-ghost" aria-hidden="true"></span>';
      const typed = label.querySelector('.heading-typed');
      const ghost = label.querySelector('.heading-ghost');
      ghost.textContent = labelText;
      label.classList.add('is-typing');
      if (title) title.classList.add('is-waiting');

      onVisible(wrap, () => {
        let n = 0;
        const type = () => {
          typed.textContent = labelText.slice(0, ++n);
          ghost.textContent = labelText.slice(n);
          if (n < labelText.length) return setTimeout(type, 45);

          // Label done: cursor blinks a moment, then the title decodes in
          if (title) {
            title.classList.remove('is-waiting');
            title.classList.add('is-in');
            decode(title, titleText, 650);
          }
          setTimeout(() => {
            label.classList.remove('is-typing');
            label.textContent = labelText;
          }, 1400);
        };
        setTimeout(type, 200);
      }, 0.4);
    });
  });

  /* ==========================================================================
     NAV: HAMBURGER
     ========================================================================== */

  const toggler = document.querySelector('.navbar-toggler');
  const collapse = document.querySelector('.navbar-collapse');

  if (toggler && collapse) {
    toggler.addEventListener('click', () => {
      const isOpen = collapse.classList.toggle('open');
      toggler.setAttribute('aria-expanded', isOpen);
    });

    document.querySelectorAll('.nav-link').forEach(link => {
      link.addEventListener('click', () => {
        collapse.classList.remove('open');
        toggler.setAttribute('aria-expanded', false);
      });
    });
  }

  /* ==========================================================================
     NAV: SCROLLED STATE + TERMINAL PATH
     ========================================================================== */

  const siteHeader = document.querySelector('header');
  const navbar = document.querySelector('.navbar');

  // Glassy, smaller header once you scroll past the top
  if (siteHeader) {
    const onScroll = () => siteHeader.classList.toggle('is-scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // joshua@stoltz:~/section$ that follows you down the page
  if (navbar) {
    const pathNames = { hero: '', about: 'about', services: 'services', pricing: 'pricing', projects: 'work', faq: 'faq', contact: 'contact' };
    const navPath = document.createElement('div');
    navPath.className = 'nav-path';
    navPath.setAttribute('aria-hidden', 'true');
    navPath.innerHTML =
  '<div class="nav-path-bar"><span class="nav-path-dots"></span>you are here</div>' +
  '<div class="nav-path-line"><span class="nav-path-user">joshua@stoltz</span>:<span class="nav-path-dir">~</span>$<span class="nav-path-caret"></span></div>';
    navbar.append(navPath);
    const dir = navPath.querySelector('.nav-path-dir');
    let current = '~';

    const setPath = target => {
      if (target === current) return;
      current = target;
      clearTimeout(dir._t);
      if (reduceMotion) { dir.textContent = target; return; }
      // Backspace to "~", then type the new folder
      const erase = () => {
        if (dir.textContent.length > 1) {
          dir.textContent = dir.textContent.slice(0, -1);
          dir._t = setTimeout(erase, 25);
        } else type(1);
      };
      const type = n => {
        dir.textContent = target.slice(0, n);
        if (n < target.length) dir._t = setTimeout(() => type(n + 1), 45);
      };
      erase();
    };

    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const name = pathNames[entry.target.id];
        setPath(name ? `~/${name}` : '~');
      });
    }, { rootMargin: '-45% 0px -50% 0px' });   // the section crossing the middle of the screen

    Object.keys(pathNames)
      .map(id => document.getElementById(id))
      .filter(Boolean)
      .forEach(sec => sectionObserver.observe(sec));
  }

  /* ==========================================================================
     HERO: TYPING ANIMATION
     ========================================================================== */

  const textElement = document.getElementById('typed-text');
  const cursor = document.querySelector('.cursor');

  if (textElement && cursor) {
    const textToType = 'Stoltz Web Design';
    let charIndex = 0;
    let isDeleting = false;

    function typeLoop() {
      textElement.textContent = textToType.substring(0, charIndex);

      if (!isDeleting && charIndex < textToType.length) {
        cursor.classList.add('typing');
        charIndex++;
        setTimeout(typeLoop, 100);
      } else if (!isDeleting && charIndex === textToType.length) {
        cursor.classList.remove('typing');
        setTimeout(() => {
          isDeleting = true;
          typeLoop();
        }, 2000);
      } else if (isDeleting && charIndex > 0) {
        cursor.classList.add('typing');
        charIndex--;
        setTimeout(typeLoop, 50);
      } else {
        isDeleting = false;
        setTimeout(typeLoop, 500);
      }
    }

    setTimeout(typeLoop, 800);
  }

  /* ==========================================================================
     ABOUT
     ========================================================================== */

  /* ---------- Feature checks: [ .. ] spinner, then [ OK ]; click for details ---------- */
  const badgeBox = document.querySelector('.about-badges');
  if (badgeBox) {
    const items = Array.from(badgeBox.querySelectorAll('.badge-item'));
    const hint = badgeBox.querySelector('.badge-hint');
    const spin = ['|', '/', '-', '\\'];

    // Spinner inside the brackets, then flip to OK with a flash
    const runCheck = (status, duration) => new Promise(done => {
      if (!status) return done();
      if (reduceMotion) { status.textContent = '[ OK ]'; return done(); }
      clearInterval(status._spin);
      status.classList.remove('is-ok');
      status.classList.add('is-checking');
      let f = 0;
      status._spin = setInterval(() => { status.textContent = `[ ${spin[f++ % 4]}  ]`; }, 80);
      setTimeout(() => {
        clearInterval(status._spin);
        status.textContent = '[ OK ]';
        status.classList.remove('is-checking');
        void status.offsetWidth;
        status.classList.add('is-ok');
        done();
      }, duration);
    });

    // Boot sequence when the badges scroll into view
    onVisible(badgeBox, async () => {
      for (const item of items) {
        item.classList.add('booted');
        await runCheck(item.querySelector('.badge-status'), 450);
      }
      if (hint) hint.classList.add('booted');
    }, 0.4);

    // Click / tap / Enter: re-run the check and show or hide the detail
    items.forEach(item => {
      const btn = item.querySelector('.badge');
      const detail = item.querySelector('.badge-detail');
      if (!btn || !detail) return;
      btn.addEventListener('click', () => {
        const open = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!open));
        detail.hidden = open;
        if (!open) runCheck(btn.querySelector('.badge-status'), 300);
      });
    });
  }

  // Terminal command types out, then the plain-English comment appears.
  // The "done" class is also what lets the bio under it print in (see .md-out in style.css).
  const termBlock = document.querySelector('.term-block');
  const termCmd = document.querySelector('.term-cmd');
  if (termBlock && termCmd) {
    const cmd = termCmd.dataset.cmd;
    if (reduceMotion) {
      termBlock.classList.add('done');
    } else {
      let started = false;
      termCmd.textContent = '';
      onVisible(termBlock, () => {
        if (started) return;
        started = true;
        let i = 0;
        const type = () => {
          termCmd.textContent = cmd.slice(0, ++i);
          if (i < cmd.length) setTimeout(type, 70);
          else setTimeout(() => termBlock.classList.add('done'), 300);
        };
        setTimeout(type, 400);
      }, 0.6);

      // Safety net: if the bio is on screen but the command line isn't (page
      // reloaded part-way down, or scrolled up from below), skip the typing
      // and show the bio right away so it is never left invisible.
      onVisible(document.querySelector('.md-out'), () => {
        setTimeout(() => {
          if (started) return;
          started = true;
          termCmd.textContent = cmd;
          termBlock.classList.add('done');
        }, 150);
      }, 0);
    }
  }

  /* ==========================================================================
     ABOUT: INTERACTIVE CODE CARD
     ========================================================================== */

  const codeCard = document.getElementById('codeCard');
  if (codeCard) {
    const tabs = Array.from(codeCard.querySelectorAll('.code-tab'));
    const files = Array.from(codeCard.querySelectorAll('.code-file'));

    // Index each line so they can print in one after another
    files.forEach(file => {
      file.querySelectorAll('.line').forEach((line, i) => line.style.setProperty('--l', i));
    });

    const printFile = file => {
      if (reduceMotion) return;
      file.classList.remove('is-printing');
      void file.offsetWidth;          // restart the animation
      file.classList.add('is-printing');
    };

    const openTab = (tab, focus = false) => {
      tabs.forEach(t => {
        const active = t === tab;
        t.classList.toggle('is-active', active);
        t.setAttribute('aria-selected', active);
        t.tabIndex = active ? 0 : -1;
      });
      files.forEach(f => {
        const active = f.id === tab.getAttribute('aria-controls');
        f.hidden = !active;
        f.classList.toggle('is-active', active);
        if (active) printFile(f);
      });
      if (focus) tab.focus();
      // Narrow screens: slide the tab bar so the open tab is fully visible
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    };

    // Fade the right edge of the tab bar while more tabs are hidden off-screen
    const tabList = codeCard.querySelector('.code-tabs');
    if (tabList) {
      const updateFade = () => tabList.classList.toggle(
        'is-clipped',
        tabList.scrollLeft + tabList.clientWidth < tabList.scrollWidth - 1
      );
      tabList.addEventListener('scroll', updateFade, { passive: true });
      window.addEventListener('resize', updateFade);
      if (document.fonts) document.fonts.ready.then(updateFade);   // widths change once the font loads
      updateFade();
    }

    tabs.forEach((tab, i) => {
      tab.addEventListener('click', () => openTab(tab));
      // Arrow keys move between tabs (standard tab pattern)
      tab.addEventListener('keydown', e => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        e.preventDefault();
        const next = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
        openTab(tabs[next], true);
      });
    });

    // Print the first file when the card scrolls into view
    const firstFile = files.find(f => !f.hidden);
    if (firstFile && !reduceMotion) {
      firstFile.style.visibility = 'hidden';
      onVisible(codeCard, () => {
        firstFile.style.visibility = '';
        printFile(firstFile);
      }, 0.4);
    }

    // Status bar explains whichever key you hover, focus or tap.
    // Only the text span is swapped, so the "i" icon next to it stays put.
    const hint = codeCard.querySelector('.code-hint');
    const hintText = hint ? hint.querySelector('span:not(.hint-icon)') : null;
    const hintDefault = hintText ? hintText.textContent : '';

    const showTip = key => {
      if (!hintText) return;
      codeCard.querySelectorAll('.k.is-tipped').forEach(k => k.classList.remove('is-tipped'));
      if (!key) {
        hintText.textContent = hintDefault;
        hint.classList.remove('is-live');
        return;
      }
      key.classList.add('is-tipped');
      const name = document.createElement('span');
      name.className = 'code-hint-key';
      name.textContent = key.textContent.replace(/"/g, '') + ':';
      hintText.replaceChildren(name, ' ' + key.dataset.tip);
      hint.classList.add('is-live');
    };

    codeCard.querySelectorAll('.k[data-tip]').forEach(key => {
      key.addEventListener('mouseenter', () => showTip(key));
      key.addEventListener('focus', () => showTip(key));
      key.addEventListener('click', () => showTip(key));
    });
    codeCard.addEventListener('mouseleave', () => showTip(null));

    // Copy button: copies the open file as real JSON (line numbers stripped)
    const copyBtn = document.getElementById('copyJsonBtn');
    if (copyBtn && navigator.clipboard) {
      const copyLabel = copyBtn.querySelector('.copy-text');
      const copyDefault = copyLabel ? copyLabel.textContent : '';

      copyBtn.addEventListener('click', async () => {
        const file = files.find(f => !f.hidden);
        if (!file) return;
        // Work on a copy so the line numbers can be removed without touching the page
        const clone = file.cloneNode(true);
        clone.querySelectorAll('.ln, .pulse-dot').forEach(el => el.remove());
        try {
          await navigator.clipboard.writeText(clone.textContent.trim());
          clearTimeout(copyBtn._reset);
          if (copyLabel) copyLabel.textContent = 'Copied';
          copyBtn.classList.add('is-copied');
          copyBtn._reset = setTimeout(() => {
            if (copyLabel) copyLabel.textContent = copyDefault;
            copyBtn.classList.remove('is-copied');
          }, 1600);
        } catch {
          // Clipboard blocked by the browser: leave the button as it is
        }
      });
    }
  }

  /* ==========================================================================
     SERVICES
     ========================================================================== */

  onVisible(document.querySelector('.services-grid'), el => el.classList.add('in-view'), 0.25);

  document.querySelectorAll('.service-card').forEach(card => {
    // Spotlight follows the cursor
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });

    // Title and description decode on hover
    const title = card.querySelector('.service-title');
    const desc = card.querySelector('.service-desc');
    const titleText = title ? textOf(title) : '';
    const descText = desc ? textOf(desc) : '';

    const playDecode = () => {
      decode(title, titleText, 500);
      if (desc) setTimeout(() => decode(desc, descText, 900, 8), 150);
    };
    card.addEventListener('mouseenter', playDecode);
    // Touch screens: decode the first time the card lights up (see TOUCH SCREENS below)
    card.addEventListener('firstlit', playDecode);
  });

  /* ==========================================================================
     SCROLL REVEAL: PRICING, FEATURED WORK, CONTACT, FOOTER
     Each group staggers its own items (--i = position in the group).
     ========================================================================== */

  if (!reduceMotion) {
    document.documentElement.classList.add('js-anim');

    const revealGroups = [
      '.pricing__header',
      '.pricing__card',
      '.pricing__note',
      '.cards-grid .card',
      '.faq-item',
      '.faq-reader',
      '.sp-steps .sp-step',
      '.sp-body > *',
      '.footer-grid > *'
    ];

    revealGroups.forEach(selector => {
      document.querySelectorAll(selector).forEach((el, i) => {
        el.classList.add('reveal');
        el.style.setProperty('--i', i);
        onVisible(el, target => target.classList.add('in-view'), 0.15);
      });
    });
  }

  /* ==========================================================================
     PRICING
     ========================================================================== */

  // Checklist items get their own index so they tick in one after another
  document.querySelectorAll('.pricing__list').forEach(list => {
    list.querySelectorAll('li').forEach((li, j) => li.style.setProperty('--j', j));
  });

  // Prices count up from $0 when the cards come into view
  onVisible(document.querySelector('.pricing__grid'), () => {
    if (reduceMotion) return;
    document.querySelectorAll('.pricing__amount').forEach((el, i) => {
      const finalText = el.textContent.trim();
      const target = parseInt(finalText.replace(/[^0-9]/g, ''), 10);
      if (!target) return;
      srText(el, finalText);
      const duration = 1100;
      const startAt = performance.now() + i * 120;

      const tick = now => {
        const t = Math.min(Math.max((now - startAt) / duration, 0), 1);
        const eased = 1 - Math.pow(1 - t, 3);                  // ease-out
        el.textContent = '$' + Math.round(target * eased).toLocaleString('en-US');
        if (t < 1) requestAnimationFrame(tick);
        else el.textContent = finalText;
      };
      requestAnimationFrame(tick);
    });
  }, 0.1);

  /* ==========================================================================
     FEATURED WORK
     ========================================================================== */

  document.querySelectorAll('.cards-grid .card').forEach((card, i) => {
    // "CLIENT #01" label decodes as the card appears
    const label = card.querySelector('.client-label');
    if (label) {
      const labelText = textOf(label);
      onVisible(card, () => setTimeout(() => decode(label, labelText, 600), 200 + i * 120), 0.15);
    }

    // Missing screenshot: keep the browser frame, show a code-style placeholder
    const img = card.querySelector('.card-preview img');
    if (img) {
      const showPlaceholder = () => {
        const name = card.querySelector('.client-name')?.textContent.trim() || 'preview';
        const ph = document.createElement('div');
        ph.className = 'preview-empty';
        ph.setAttribute('aria-hidden', 'true');
        ph.textContent = `<${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')} />`;
        img.replaceWith(ph);
      };
      if (img.complete && img.naturalWidth === 0) showPlaceholder();
      else img.addEventListener('error', showPlaceholder);
    }

    // 3D tilt that follows the mouse (max 6 degrees)
    if (reduceMotion) return;
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      card.style.setProperty('--ry', `${(x * 12).toFixed(2)}deg`);
      card.style.setProperty('--rx', `${(-y * 12).toFixed(2)}deg`);
    });
    card.addEventListener('mouseleave', () => {
      card.style.setProperty('--rx', '0deg');
      card.style.setProperty('--ry', '0deg');
    });
  });

  /* ==========================================================================
     FAQ
     ========================================================================== */

  document.querySelectorAll('.faq-item').forEach((item, i) => {
    const q = item.querySelector('.faq-q');
    const answer = item.querySelector('.faq-answer');
    const num = item.querySelector('.faq-num');
    const qText = q ? textOf(q) : '';

    // Question decodes the first time it scrolls into view
    onVisible(item, () => setTimeout(() => decode(q, qText, 600), 150 + i * 90), 0.3);

    // Spotlight follows the cursor (same idea as the service cards)
    item.addEventListener('mousemove', e => {
      const r = item.getBoundingClientRect();
      item.style.setProperty('--mx', `${e.clientX - r.left}px`);
      item.style.setProperty('--my', `${e.clientY - r.top}px`);
    });

    if (!answer) return;

    // Terminal line injected above each answer: $ cat faq/04.md
    const cmd = `cat faq/${num ? num.textContent.trim() : String(i + 1).padStart(2, '0')}.md`;
    const line = document.createElement('p');
    line.className = 'faq-cmd';
    line.setAttribute('aria-hidden', 'true');
    line.innerHTML = '<span class="faq-prompt">$</span> <span class="faq-cmd-text"></span><span class="faq-caret"></span>';
    answer.prepend(line);
    const cmdText = line.querySelector('.faq-cmd-text');

    // Desktop reader: the question repeats as the heading of the answer pane
    // (hidden on phones, see .faq-pane-q in style.css)
    const paneQ = document.createElement('p');
    paneQ.className = 'faq-pane-q';
    paneQ.setAttribute('aria-hidden', 'true');
    paneQ.textContent = qText;
    line.after(paneQ);

    const showInstantly = () => {
      cmdText.textContent = cmd;
      item.classList.add('is-typed');
    };

    // An item that starts open fires one toggle on load; skip replaying it
    let skipFirst = item.open;
    if (reduceMotion || item.open) showInstantly();

    item.addEventListener('toggle', () => {
      if (skipFirst) { skipFirst = false; if (item.open) return; }
      clearTimeout(item._typeTimer);
      if (!item.open) {
        item.classList.remove('is-typed', 'is-scanning');
        return;
      }
      if (reduceMotion) return showInstantly();

      decode(q, qText, 400);

      // restart the scanline sweep
      item.style.setProperty('--scan-end', `${item.querySelector('summary').offsetHeight + answer.scrollHeight}px`);
      item.classList.remove('is-scanning');
      void item.offsetWidth;
      item.classList.add('is-scanning');

      // type the command, then reveal the answer text
      let c = 0;
      cmdText.textContent = '';
      const type = () => {
        cmdText.textContent = cmd.slice(0, ++c);
        if (c < cmd.length) item._typeTimer = setTimeout(type, 28);
        else item._typeTimer = setTimeout(() => item.classList.add('is-typed'), 120);
      };
      item._typeTimer = setTimeout(type, 180);
    });
  });

  /* ---------- FAQ reader (769px and up) ----------
     Questions on the left, the open answer on the right. The layout itself is
     CSS; this keeps one answer open, runs previous / next and the arrow keys,
     and updates the "01 / 09" counter. On phones the FAQ is a plain accordion
     and only the counter code runs (unseen). */
  const faqReader = document.querySelector('.faq-reader');

  if (faqReader) {
    const faqItems = Array.from(faqReader.querySelectorAll('.faq-item'));
    const faqCount = faqReader.querySelector('.faq-bar-count');
    const readerMode = window.matchMedia('(min-width: 769px)');
    const pad = n => String(n).padStart(2, '0');

    const openIndex = () => faqItems.findIndex(item => item.open);

    const updateCount = () => {
      const i = openIndex();
      if (faqCount && i > -1) faqCount.textContent = `${pad(i + 1)} / ${pad(faqItems.length)}`;
    };

    // Opening one item closes the rest (they share name="faq")
    const openItem = (i, focus = false) => {
      const item = faqItems[(i + faqItems.length) % faqItems.length];
      item.open = true;
      if (focus) item.querySelector('summary').focus();
    };

    faqItems.forEach((item, i) => {
      const summary = item.querySelector('summary');
      item.addEventListener('toggle', updateCount);

      // In the reader one answer is always showing, so the open question can't be clicked shut
      summary.addEventListener('click', e => {
        if (readerMode.matches && item.open) e.preventDefault();
      });

      // Up / down arrows walk the list
      summary.addEventListener('keydown', e => {
        if (!readerMode.matches || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
        e.preventDefault();
        openItem(i + (e.key === 'ArrowDown' ? 1 : -1), true);
      });
    });

    faqReader.querySelectorAll('.faq-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => openItem(Math.max(openIndex(), 0) + Number(btn.dataset.step)));
    });

    // Widening from phone size with everything closed: show the first answer
    const ensureOpen = () => {
      if (readerMode.matches && openIndex() === -1) openItem(0);
    };
    readerMode.addEventListener('change', ensureOpen);
    ensureOpen();
    updateCount();
  }

  /* ==========================================================================
     CONTACT (START A PROJECT)
     ========================================================================== */

  // Step titles ("FILL OUT FORM") decode as they appear
  document.querySelectorAll('.sp-step-title').forEach((title, i) => {
    const stepText = textOf(title);
    onVisible(title, () => setTimeout(() => decode(title, stepText, 700), 150 + i * 120), 0.5);
  });

  // Contact form: a message under each field, a timeline that fills as the
  // required fields are completed, and a "Message sent" panel in place of
  // the old redirect to /thanks.html
  const startProject = document.querySelector('.start-project');
  const form = document.getElementById('contactForm');
  const sentPanel = startProject ? startProject.querySelector('.sp-sent') : null;

  if (startProject && form && sentPanel) {
    const steps = startProject.querySelectorAll('.sp-step');
    const countText = startProject.querySelector('.sp-count-value');
    const statusText = startProject.querySelector('.sp-status');
    const submitBtn = form.querySelector('.sp-btn');
    const btnLabel = form.querySelector('.sp-btn-label');
    const btnText = btnLabel.textContent;
    const requiredFields = Array.from(form.querySelectorAll('[required]'));
    const errorOf = field => document.getElementById(`${field.id}-error`);

    // Use the messages below instead of the browser's own validation bubbles
    form.noValidate = true;

    const isValid = field => field.value.trim() !== '' && field.checkValidity();

    // Show or clear the message under one field; returns true when it is valid.
    // The wording lives in the data-missing / data-invalid attributes in the HTML.
    const checkField = field => {
      const ok = isValid(field);
      let message = '';
      if (!ok) {
        message = field.value.trim() === ''
          ? field.dataset.missing
          : (field.dataset.invalid || field.dataset.missing);
      }
      field.setAttribute('aria-invalid', String(!ok));
      errorOf(field).textContent = message;
      return ok;
    };

    const clearField = field => {
      field.removeAttribute('aria-invalid');
      errorOf(field).textContent = '';
    };

    // Line from step 01 toward 02 (--sp-progress runs 0 to 1, see style.css)
    const updateTimeline = () => {
      const done = requiredFields.filter(isValid).length;
      startProject.style.setProperty('--sp-progress', done / requiredFields.length);
      if (countText) countText.textContent = ` / ${done} of ${requiredFields.length} complete`;
      steps[0].classList.toggle('is-done', done === requiredFields.length);
    };

    requiredFields.forEach(field => {
      field.addEventListener('blur', () => checkField(field));
      ['input', 'change'].forEach(type => {
        field.addEventListener(type, () => {
          // Once a field has shown an error, re-check it as the visitor types
          if (field.getAttribute('aria-invalid') === 'true') checkField(field);
          updateTimeline();
        });
      });
    });

    const resetBtn = () => {
      submitBtn.classList.remove('is-sending');
      submitBtn.disabled = false;
      btnLabel.textContent = btnText;
    };

    const showSent = () => {
      const nameField = form.querySelector('[name="name"]');
      const firstName = nameField ? nameField.value.trim().split(/\s+/)[0] : '';
      sentPanel.querySelector('.sp-sent-name').textContent = firstName || 'there';

      form.hidden = true;
      sentPanel.hidden = false;
      startProject.style.setProperty('--sp-progress', 1);
      steps[0].classList.add('is-done');
      if (steps[1]) steps[1].classList.add('is-current');   // 24-hr review is now the live step
      sentPanel.querySelector('.sp-sent-title').focus();
    };

    // reCAPTCHA v3: ask Google for a one-time token that Formspree verifies
    const RECAPTCHA_SITE_KEY = '6LflMOQtAAAAACCQQO16reyTGxxkavxoKQ863CHY';
    const getRecaptchaToken = () => new Promise((resolve, reject) => {
      if (typeof grecaptcha === 'undefined') return reject(new Error('reCAPTCHA did not load'));
      grecaptcha.ready(() => {
        grecaptcha.execute(RECAPTCHA_SITE_KEY, { action: 'submit' }).then(resolve, reject);
      });
    });

    form.addEventListener('submit', async e => {
      e.preventDefault();

      // Check every required field, then jump to the first one that needs fixing
      const firstBad = requiredFields.filter(field => !checkField(field))[0];
      if (firstBad) {
        firstBad.focus();
        return;
      }

      statusText.textContent = '';
      submitBtn.classList.add('is-sending');
      submitBtn.disabled = true;
      btnLabel.textContent = 'Sending...';

      try {
        const data = new FormData(form);
        data.append('g-recaptcha-response', await getRecaptchaToken());
        const res = await fetch(form.action, {
          method: 'POST',
          body: data,
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) showSent();
        else statusText.textContent = statusText.dataset.message;
      } catch {
        statusText.textContent = statusText.dataset.message;
      }
      resetBtn();
    });

    // "Send another message" puts the empty form back
    sentPanel.querySelector('.sp-sent-reset').addEventListener('click', () => {
      form.reset();
      requiredFields.forEach(clearField);
      sentPanel.hidden = true;
      form.hidden = false;
      if (steps[1]) steps[1].classList.remove('is-current');
      updateTimeline();
      requiredFields[0].focus();
    });

    // Covers browser autofill and back/forward restores
    updateTimeline();
  }

  /* ==========================================================================
     SCROLL-DOT NAVIGATION
     ========================================================================== */

  const dotsNav = document.getElementById('scrollDots');
  const scrollDots = document.querySelectorAll('.scroll-dots .dot');
  const navSections = ['hero', 'about', 'services', 'pricing', 'projects', 'faq', 'contact']
    .map(id => document.getElementById(id))
    .filter(Boolean);

  // Click a dot -> smooth scroll to its section
  scrollDots.forEach(dot => {
    dot.addEventListener('click', () => {
      const target = document.getElementById(dot.dataset.target);
      if (target) target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  // Highlight the dot for the section in view
  const dotObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        scrollDots.forEach(d => d.classList.remove('active'));
        const activeDot = document.querySelector(`.scroll-dots .dot[data-target="${entry.target.id}"]`);
        if (activeDot) activeDot.classList.add('active');
      }
    });
  }, { rootMargin: '-45% 0px -50% 0px' });   // whichever section crosses the middle of the screen

  navSections.forEach(sec => dotObserver.observe(sec));

  // Lime progress fill along the rail
  if (dotsNav) {
    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      dotsNav.style.setProperty('--progress', max > 0 ? window.scrollY / max : 0);
      // At the very bottom the footer fills the screen: light up the last dot
      if (max > 0 && window.scrollY >= max - 4 && scrollDots.length) {
        scrollDots.forEach(d => d.classList.remove('active'));
        scrollDots[scrollDots.length - 1].classList.add('active');
      }
      // Dock (tablet/phone) only shows once you're past the hero
      dotsNav.classList.toggle('is-visible', window.scrollY > window.innerHeight * 0.5);
    };
    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
  }

  /* ==========================================================================
     TOUCH SCREENS (PHONES & TABLETS)
     Hover effects never fire without a mouse, so on touch screens each card
     "lights up" (.is-lit) while it passes through the middle of the screen,
     and the hero buttons / FAQ items react to taps instead.
     ========================================================================== */

  const isTouch = window.matchMedia('(hover: none)').matches;

  if (isTouch && !reduceMotion) {
    document.documentElement.classList.add('touch-anim');

    const litTargets = document.querySelectorAll(
      '.service-card, .pricing__card, .cards-grid .card, .about-image-wrapper'
    );

    const litObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const el = entry.target;
        el.classList.toggle('is-lit', entry.isIntersecting);
        // One-time extras (e.g. the service card decode) listen for this
        if (entry.isIntersecting && !el._litOnce) {
          el._litOnce = true;
          el.dispatchEvent(new CustomEvent('firstlit'));
        }
      });
    }, { rootMargin: '-35% 0px -35% 0px' });   // the middle 30% of the screen

    litTargets.forEach(el => litObserver.observe(el));

    // Hero buttons: neon glitch on tap
    document.querySelectorAll('.hero-cta .btn-primary-custom, .hero-cta .btn-outline-custom').forEach(btn => {
      btn.addEventListener('pointerdown', () => {
        btn.classList.remove('is-glitching');
        void btn.offsetWidth;          // restart the animation
        btn.classList.add('is-glitching');
      });
      btn.addEventListener('animationend', () => btn.classList.remove('is-glitching'));
    });

    // FAQ: spotlight glows out from wherever the question was tapped
    document.querySelectorAll('.faq-item').forEach(item => {
      item.addEventListener('pointerdown', e => {
        const r = item.getBoundingClientRect();
        item.style.setProperty('--mx', `${e.clientX - r.left}px`);
        item.style.setProperty('--my', `${e.clientY - r.top}px`);
      });
    });
  }

});