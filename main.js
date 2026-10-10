/* Comportements du site : langue, navigation, défilement fluide (Lenis),
   apparitions au scroll (GSAP + ScrollTrigger), texte qui se décode, compteurs. */
(() => {
  'use strict';

  const root = document.documentElement;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
  const hasLenis = typeof window.Lenis !== 'undefined';
  const animate = hasGsap && !reduceMotion;

  const nav = document.getElementById('nav');
  const toggle = document.getElementById('navToggle');
  const langButtons = Array.from(document.querySelectorAll('[data-lang]'));
  const counters = Array.from(document.querySelectorAll('[data-count]'));
  const scrambles = Array.from(document.querySelectorAll('[data-scramble]'));

  /* localStorage peut être bloqué (navigation privée, réglages) */
  const store = {
    get(key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    set(key, value) {
      try { window.localStorage.setItem(key, value); } catch (e) { /* sans effet */ }
    }
  };

  let currentLang = 'en';
  let stReady = false;

  /* =========================================================
     Texte qui se décode (touche igloo.inc)
     ========================================================= */
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+=/<>';
  const KEEP = new Set([' ', '·', ' ']);
  const scrambleFrames = new WeakMap();
  const seen = new WeakSet();

  function scramble(el) {
    const finalText = el.dataset.text || el.textContent;
    el.dataset.text = finalText;
    const pending = scrambleFrames.get(el);
    if (pending) cancelAnimationFrame(pending);
    if (reduceMotion) {
      el.textContent = finalText;
      return;
    }
    const len = finalText.length;
    const duration = 600 + len * 22;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      const revealed = Math.floor(progress * len);
      let out = '';
      for (let i = 0; i < len; i++) {
        const ch = finalText[i];
        out += i < revealed || KEEP.has(ch) ? ch : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      }
      el.textContent = out;
      if (progress < 1) scrambleFrames.set(el, requestAnimationFrame(tick));
      else {
        el.textContent = finalText;
        scrambleFrames.delete(el);
      }
    };
    scrambleFrames.set(el, requestAnimationFrame(tick));
  }

  /* =========================================================
     Compteurs des chiffres clés
     ========================================================= */
  const counterValue = new Map(); // valeur affichée pendant l'animation

  function formatNumber(n) {
    return new Intl.NumberFormat(currentLang === 'fr' ? 'fr-FR' : 'en-GB').format(n);
  }

  function renderCounter(el) {
    const target = Number(el.dataset.count);
    const value = counterValue.has(el) ? counterValue.get(el) : target;
    el.textContent = formatNumber(Math.round(value));
  }

  /* =========================================================
     Langue
     ========================================================= */
  function updateToggleLabel() {
    const dict = window.I18N && window.I18N[currentLang];
    if (!dict || !toggle) return;
    toggle.textContent = nav.classList.contains('is-open') ? dict['nav.close'] : dict['nav.menu'];
  }

  function applyLang(lang) {
    const dict = window.I18N && window.I18N[lang];
    if (!dict) return;
    currentLang = lang;
    root.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const value = dict[el.dataset.i18n];
      if (value == null) return;
      if (el.hasAttribute('data-scramble')) {
        el.dataset.text = value;
        if (seen.has(el)) scramble(el);
        else el.textContent = value;
      } else {
        el.textContent = value;
      }
    });
    document.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const value = dict[el.dataset.i18nHtml];
      if (value != null) el.innerHTML = value;
    });
    document.querySelectorAll('[data-i18n-aria]').forEach((el) => {
      const value = dict[el.dataset.i18nAria];
      if (value != null) el.setAttribute('aria-label', value);
    });

    if (dict['meta.title']) document.title = dict['meta.title'];
    const description = document.querySelector('meta[name="description"]');
    if (description && dict['meta.description']) description.setAttribute('content', dict['meta.description']);

    langButtons.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
    updateToggleLabel();
    counters.forEach(renderCounter);
    store.set('lang', lang);

    // la longueur des textes change, donc les positions de déclenchement aussi
    if (stReady) window.ScrollTrigger.refresh();
  }

  function initialLang() {
    const saved = store.get('lang');
    if (saved === 'en' || saved === 'fr') return saved;
    const browser = (navigator.language || 'en').toLowerCase();
    return browser.startsWith('fr') ? 'fr' : 'en';
  }

  langButtons.forEach((b) => b.addEventListener('click', () => applyLang(b.dataset.lang)));

  /* =========================================================
     Défilement fluide (Lenis)
     ========================================================= */
  let lenis = null;
  if (hasLenis && !reduceMotion) {
    lenis = new window.Lenis({ lerp: 0.09 });
    if (hasGsap) {
      lenis.on('scroll', window.ScrollTrigger.update);
      window.gsap.ticker.add((time) => lenis.raf(time * 1000));
      window.gsap.ticker.lagSmoothing(0);
    } else {
      const raf = (time) => {
        lenis.raf(time);
        requestAnimationFrame(raf);
      };
      requestAnimationFrame(raf);
    }
  }

  /* =========================================================
     Navigation
     ========================================================= */
  function openMenu() {
    nav.classList.add('is-open');
    toggle.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
    if (lenis) lenis.stop();
    updateToggleLabel();
  }

  function closeMenu() {
    if (!nav.classList.contains('is-open')) return;
    nav.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
    if (lenis) lenis.start();
    updateToggleLabel();
  }

  toggle.addEventListener('click', () => (nav.classList.contains('is-open') ? closeMenu() : openMenu()));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
  window.matchMedia('(min-width: 861px)').addEventListener('change', (e) => {
    if (e.matches) closeMenu();
  });

  // liens internes : défilement fluide avec compensation de la barre fixe
  document.querySelectorAll('a[href^="#"]').forEach((a) => {
    if (a.classList.contains('skip')) return;
    a.addEventListener('click', (e) => {
      const hash = a.getAttribute('href');
      if (hash === '#') {
        e.preventDefault(); // liens encore à compléter (LinkedIn, GitHub)
        return;
      }
      const target = document.querySelector(hash);
      if (!target) return;
      e.preventDefault();
      closeMenu();
      const offset = hash === '#top' ? 0 : -nav.offsetHeight;
      if (lenis) lenis.scrollTo(target, { offset, duration: 1.4 });
      else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });

  // fond de la barre après le haut de page
  const setScrolled = () => nav.classList.toggle('is-scrolled', window.scrollY > 24);
  window.addEventListener('scroll', setScrolled, { passive: true });
  setScrolled();

  // lien actif selon la section visible
  if ('IntersectionObserver' in window) {
    const links = new Map(
      Array.from(document.querySelectorAll('.nav__links a')).map((a) => [a.getAttribute('href').slice(1), a])
    );
    const spy = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          links.forEach((a) => a.classList.remove('is-active'));
          const link = links.get(entry.target.id);
          if (link) link.classList.add('is-active');
        });
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    document.querySelectorAll('main section[id]').forEach((s) => spy.observe(s));
  }

  /* =========================================================
     Langue initiale (avant les animations, pour mesurer les bons textes)
     ========================================================= */
  applyLang(initialLang());

  /* =========================================================
     Animations
     ========================================================= */
  if (animate) {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    root.classList.add('anim-ready');

    // entrée du hero
    gsap.fromTo('.hero__title', { opacity: 0, yPercent: 14 }, { opacity: 1, yPercent: 0, duration: 1.6, ease: 'expo.out', delay: 0.15 });
    gsap.fromTo(
      '.intro:not(.hero__title)',
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, delay: 0.45 }
    );

    // le texte du hero remonte et s'efface au scroll
    gsap.to('.hero__content', {
      yPercent: -16,
      opacity: 0.15,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });

    // apparitions des blocs
    ScrollTrigger.batch('.reveal', {
      start: 'top 88%',
      once: true,
      onEnter: (els) =>
        gsap.to(els, { opacity: 1, y: 0, duration: 1.2, ease: 'expo.out', stagger: 0.08, overwrite: true })
    });

    // compteurs
    counters.forEach((el) => {
      const state = { v: 0 };
      counterValue.set(el, 0);
      renderCounter(el);
      ScrollTrigger.create({
        trigger: el,
        start: 'top 90%',
        once: true,
        onEnter: () =>
          gsap.to(state, {
            v: Number(el.dataset.count),
            duration: 1.8,
            ease: 'power3.out',
            onUpdate: () => {
              counterValue.set(el, state.v);
              renderCounter(el);
            },
            onComplete: () => {
              counterValue.delete(el);
              renderCounter(el);
            }
          })
      });
    });

    stReady = true;
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => ScrollTrigger.refresh());
  } else {
    root.classList.remove('js-anim');
  }

  // texte qui se décode à la première apparition
  if ('IntersectionObserver' in window && !reduceMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          seen.add(entry.target);
          scramble(entry.target);
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.6 }
    );
    scrambles.forEach((el) => io.observe(el));
  }

  /* =========================================================
     Carrousel des projets : glisser à la souris, balayer au doigt
     ou au trackpad, clavier (la piste est focalisable)
     ========================================================= */
  document.querySelectorAll('[data-carousel]').forEach((carousel) => {
    const track = carousel.querySelector('.carousel__track');
    const cards = track ? Array.from(track.querySelectorAll('.project')) : [];
    if (!cards.length) return;

    // Débords jusqu'aux bords de la fenêtre, mesurés plutôt que calculés en CSS :
    // 100vw y compte la barre de défilement sur certains systèmes, ce qui décalerait l'aimantation.
    function measureBleed() {
      const r = carousel.getBoundingClientRect();
      carousel.style.setProperty('--bleed-left', Math.max(0, r.left).toFixed(1) + 'px');
      carousel.style.setProperty('--bleed', Math.max(0, root.clientWidth - r.right).toFixed(1) + 'px');
    }
    measureBleed();
    // au-delà de la largeur maximale, la colonne se déplace sans changer de taille : il faut aussi resize
    window.addEventListener('resize', measureBleed);
    if ('ResizeObserver' in window) new ResizeObserver(measureBleed).observe(carousel);

    // Sur écran large, le titre de section est dans la colonne de gauche, que les cartes
    // traversent dès qu'elles ont quitté leur position de départ : il s'efface le temps qu'elles y sont.
    const label = carousel.closest('.section') && carousel.closest('.section').querySelector('.section__label');
    const wide = window.matchMedia('(min-width: 861px)');
    let labelTick = false;
    function updateLabel() {
      labelTick = false;
      if (label) label.classList.toggle('is-covered', wide.matches && track.scrollLeft > 2);
    }
    track.addEventListener(
      'scroll',
      () => {
        if (labelTick) return;
        labelTick = true;
        requestAnimationFrame(updateLabel);
      },
      { passive: true }
    );
    wide.addEventListener('change', updateLabel);

    const offsetOf = (i) => cards[i].offsetLeft - cards[0].offsetLeft;
    const maxLeft = () => track.scrollWidth - track.clientWidth;

    // carte la plus proche du bord gauche, ou la dernière quand on est au bout
    function index() {
      const left = track.scrollLeft;
      if (left >= maxLeft() - 4) return cards.length - 1;
      let best = 0;
      for (let i = 1; i < cards.length; i++) {
        if (Math.abs(offsetOf(i) - left) < Math.abs(offsetOf(best) - left)) best = i;
      }
      return best;
    }

    function goTo(i) {
      const target = Math.max(0, Math.min(cards.length - 1, i));
      track.scrollTo({ left: Math.min(offsetOf(target), maxLeft()), behavior: reduceMotion ? 'auto' : 'smooth' });
    }

    // Lenis capte la molette pour faire défiler la page : on lui laisse les gestes
    // verticaux, et on garde pour le carrousel les gestes horizontaux (trackpad, Maj + molette).
    track.addEventListener(
      'wheel',
      (e) => {
        if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.stopPropagation();
      },
      { passive: true }
    );

    // glisser à la souris ; le tactile et le trackpad défilent nativement
    let drag = null;
    let suppressClick = false;

    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      suppressClick = false;
      drag = { id: e.pointerId, x: e.clientX, left: track.scrollLeft, from: index(), moved: false };
    });

    track.addEventListener('pointermove', (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved) {
        if (Math.abs(dx) < 6) return;
        drag.moved = true;
        track.setPointerCapture(drag.id);
        track.classList.add('is-dragging'); // coupe l'aimantation pendant le geste
        const selection = window.getSelection && window.getSelection();
        if (selection) selection.removeAllRanges();
      }
      track.scrollLeft = drag.left - dx;
    });

    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { moved, x, from } = drag;
      drag = null;
      if (!moved) return;
      suppressClick = true;
      // un geste franc passe à la carte voisine même s'il n'a pas franchi la moitié
      const dx = e.clientX - x;
      let target = index();
      if (target === from && Math.abs(dx) > 60) target = from + (dx < 0 ? 1 : -1);
      // l'aimantation revient avant le défilement final, qui vise un point d'aimantation :
      // la rétablir pendant le défilement l'interromprait
      track.classList.remove('is-dragging');
      goTo(target);
    };
    track.addEventListener('pointerup', endDrag);
    track.addEventListener('pointercancel', endDrag);

    // un glisser ne doit pas valoir un clic sur un lien de carte
    track.addEventListener(
      'click',
      (e) => {
        if (!suppressClick) return;
        suppressClick = false;
        e.preventDefault();
        e.stopPropagation();
      },
      true
    );
  });

  /* =========================================================
     Divers
     ========================================================= */
  const year = document.getElementById('year');
  if (year) year.textContent = String(new Date().getFullYear());

  const todo = document.querySelectorAll('[data-todo]');
  if (todo.length) {
    console.info('[site] Liens à compléter :', Array.from(todo).map((a) => a.dataset.todo).join(', '));
  }
})();
