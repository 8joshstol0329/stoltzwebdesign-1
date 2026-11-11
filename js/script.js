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
     NAV: SCROLLED STATE, CURRENT SECTION, PHONE/TABLET MENU
     ========================================================================== */

  const siteHeader = document.querySelector('header');
  const navMenu = document.getElementById('navMenu');

  // Glassy, smaller header once you scroll past the top
  if (siteHeader) {
    const onScroll = () => siteHeader.classList.toggle('is-scrolled', window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // Where you are: lights up the matching link and updates the terminal path
  // (the tab under the links on desktop, the menu's title bar on phones)
  if (navMenu) {
    const pathNames = { hero: '', about: 'about', services: 'services', work: 'work', pricing: 'pricing', faq: 'faq', contact: 'contact' };
    const links = Array.from(navMenu.querySelectorAll('.nav-links .nav-link'));
    const menuDir = navMenu.querySelector('.nav-menu-bar .nav-path-dir');

    // Desktop tab: joshua@stoltz:~/services$ (shown once you're past the hero)
    const navPath = document.createElement('div');
    navPath.className = 'nav-path';
    navPath.setAttribute('aria-hidden', 'true');
    navPath.innerHTML = '<span class="nav-path-user">joshua@stoltz</span>:<span class="nav-path-dir">~</span>$<span class="nav-path-caret"></span>';
    navMenu.append(navPath);
    const dir = navPath.querySelector('.nav-path-dir');
    let current = '~';

    const setPath = target => {
      if (menuDir) menuDir.textContent = target;
      navPath.classList.toggle('is-showing', target !== '~');
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

    const setActive = id => {
      links.forEach(link => {
        const on = link.getAttribute('href') === `#${id}`;
        link.classList.toggle('is-active', on);
        if (on) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    };

    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const id = entry.target.id;
        const name = pathNames[id];
        setPath(name ? `~/${name}` : '~');
        setActive(id);
      });
    }, { rootMargin: '-45% 0px -50% 0px' });   // the section crossing the middle of the screen

    Object.keys(pathNames)
      .map(id => document.getElementById(id))
      .filter(Boolean)
      .forEach(sec => sectionObserver.observe(sec));

    // Phone/tablet menu: the >_ button opens it; a link, Esc, a tap outside
    // or widening to desktop closes it
    const toggle = document.querySelector('.nav-toggle');
    if (toggle) {
      const setOpen = open => {
        navMenu.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
      };
      const isOpen = () => navMenu.classList.contains('is-open');

      toggle.addEventListener('click', () => setOpen(!isOpen()));
      navMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));

      document.addEventListener('keydown', e => {
        if (e.key === 'Escape' && isOpen()) {
          setOpen(false);
          toggle.focus();
        }
      });
      document.addEventListener('click', e => {
        if (isOpen() && !navMenu.contains(e.target) && !toggle.contains(e.target)) setOpen(false);
      });
      window.matchMedia('(min-width: 992px)').addEventListener('change', e => { if (e.matches) setOpen(false); });
    }
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

    // Spotlight follows the cursor
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

  // Contact form: a message under each field, a timeline that fills as the
  // required fields are completed, and a "Message sent" panel in place of
  // the old redirect to /thanks.html
  const startProject = document.querySelector('.start-project');
  const form = document.getElementById('contactForm');
  const sentPanel = startProject ? startProject.querySelector('.sp-sent') : null;

  if (startProject && form && sentPanel) {
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

    // "/ 2 of 4 complete" next to the Required note
    const updateTimeline = () => {
      const done = requiredFields.filter(isValid).length;
      if (countText) countText.textContent = ` / ${done} of ${requiredFields.length} complete`;
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
      updateTimeline();
      requiredFields[0].focus();
    });

    // Covers browser autofill and back/forward restores
    updateTimeline();
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
      '.pricing__card, .cards-grid .card'
    );

    const litObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.target.classList.toggle('is-lit', entry.isIntersecting));
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

  /* ==========================================================================
     PROCESS (HOW IT WORKS)
     ========================================================================== */

  // The line draws across, then each step fades in, once the section is on
  // screen. Skipped for reduced motion, so the steps just show.
  const processTrack = document.querySelector('.process-track');
  if (processTrack && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    processTrack.classList.add('is-waiting');
    onVisible(processTrack, el => el.classList.remove('is-waiting'), 0.3);
  }
});