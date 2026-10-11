/* AURA — vanilla interactions + progressive-enhancement GSAP animation.
   No build step. If the animation CDN is unavailable, navigation and dialogs
   still work, and all page content remains visible.
   GSAP references: https://gsap.com/docs/v3/GSAP/gsap.matchMedia()/
                    https://gsap.com/docs/v3/Plugins/ScrollTrigger/
*/
(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const root = document.documentElement;
  const header = $('.site-header');
  const main = $('main');
  const footer = $('.site-footer');
  const menuToggle = $('.menu-toggle');
  const mobileMenu = $('.mobile-menu');
  const motionButton = $('.motion-toggle');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const mobileScreen = window.matchMedia('(max-width: 760px)');
  const hasGSAP = typeof window.gsap !== 'undefined';
  const hasScrollTrigger = hasGSAP && typeof window.ScrollTrigger !== 'undefined';
  let menuOpen = false;
  let animationMedia = null;
  let firstEntrance = true;
  let pointerCleanup = () => {};
  let preferredMotion = true;
  let ambientTweens = [];

  try {
    preferredMotion = localStorage.getItem('aura-motion') !== 'off';
  } catch (_) {
    // Privacy modes may disallow storage. The control still works this visit.
  }

  $('#year').textContent = String(new Date().getFullYear());

  // Header and reading progress are independent of any animation library.
  let scrollQueued = false;
  const updateScrollUI = () => {
    const y = window.scrollY;
    header.classList.toggle('scrolled', y > 35);
    const total = root.scrollHeight - window.innerHeight;
    const fraction = total > 0 ? Math.min(1, Math.max(0, y / total)) : 0;
    $('.reading-progress').style.transform = `scaleX(${fraction})`;
    scrollQueued = false;
  };
  window.addEventListener('scroll', () => {
    if (!scrollQueued) {
      requestAnimationFrame(updateScrollUI);
      scrollQueued = true;
    }
  }, { passive: true });
  window.addEventListener('resize', updateScrollUI, { passive: true });
  updateScrollUI();

  // Mobile navigation: inert background, Escape dismissal, and keyboard trap.
  function setMenu(open, restoreFocus = true) {
    menuOpen = open;
    if (!open && mobileMenu.contains(document.activeElement)) menuToggle.focus();
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    mobileMenu.inert = !open;
    mobileMenu.classList.toggle('is-open', open);
    document.body.classList.toggle('menu-open', open);
    main.inert = open;
    footer.inert = open;
    if (open) {
      $('a', mobileMenu).focus({ preventScroll: true });
    } else if (restoreFocus) {
      menuToggle.focus({ preventScroll: true });
    }
    syncAmbientPlayback();
  }

  menuToggle.addEventListener('click', () => setMenu(!menuOpen));
  $$('a', mobileMenu).forEach(link => link.addEventListener('click', () => {
    setMenu(false, false);
    const destination = $(link.getAttribute('href'));
    if (destination) {
      destination.setAttribute('tabindex', '-1');
      destination.focus({ preventScroll: true });
      destination.addEventListener('blur', () => destination.removeAttribute('tabindex'), { once: true });
    }
  }));
  $$('a', header).forEach(link => link.addEventListener('click', () => {
    if (menuOpen) setMenu(false, false);
  }));
  document.addEventListener('keydown', event => {
    if (!menuOpen) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      setMenu(false);
    }
    if (event.key === 'Tab') {
      const items = [...$$('a, button', header).filter(el => el.getClientRects().length), ...$$('a', mobileMenu)];
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  mobileScreen.addEventListener('change', event => {
    if (!event.matches && menuOpen) setMenu(false, false);
  });

  // Fictional creative studies, not fabricated client case studies.
  const projects = {
    chromatic: {
      number: '001',
      title: 'Chromatic Fields',
      description: 'What if color could be a place, rather than a surface? This self-initiated study explores that question through a folded, iridescent form. Peach highlights turn into violet shadows as repeated curves create an unfamiliar rhythm. Built entirely from layered CSS gradients, it is a small experiment in making a flat screen feel a little more dimensional.',
      tags: ['Art direction', 'CSS sculpture', 'Color exploration']
    },
    soft: {
      number: '002',
      title: 'Soft Systems',
      description: 'Technology doesn’t have to feel cold. Soft Systems pairs an exacting grid with three pillowy, sage-green forms: a quiet contrast between the systematic and the sensory. This concept explores a gentler digital language through rounded geometry, restrained movement, and a palette that feels organic rather than mechanical.',
      tags: ['Digital design', 'Form study', 'Interaction']
    },
    elsewhere: {
      number: '003',
      title: 'Elsewhere',
      description: 'A doorway with no building. A sunset with no destination. Elsewhere is an imaginary landscape made with nothing but gradients, perspective, and a little suspension of disbelief. This world-building sketch asks how very few elements can suggest a much larger story—and leave enough space for you to step into it.',
      tags: ['World building', 'CSS landscape', 'Visual storytelling']
    }
  };
  const dialog = $('.project-dialog');
  let lastProjectTrigger = null;

  $$('.work').forEach(button => button.addEventListener('click', () => {
    const project = projects[button.dataset.project];
    if (!project) return;
    lastProjectTrigger = button;
    $('#project-label').textContent = `INDEPENDENT EXPERIMENT / ${project.number}`;
    $('#project-title').textContent = project.title;
    $('#project-description').textContent = project.description;
    const tags = $('.dialog-tags');
    tags.replaceChildren(...project.tags.map(tag => {
      const element = document.createElement('span');
      element.textContent = tag;
      return element;
    }));
    const artwork = $('.work-art', button).cloneNode(true);
    $('.dialog-art').replaceChildren(artwork);
    dialog.showModal();
    dialog.scrollTop = 0;
    document.body.classList.add('dialog-open');
    syncAmbientPlayback();
  }));

  $('.dialog-close').addEventListener('click', () => dialog.close());
  let backdropPress = false;
  dialog.addEventListener('pointerdown', event => {
    const box = dialog.getBoundingClientRect();
    backdropPress = event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom);
  });
  dialog.addEventListener('click', event => {
    const box = dialog.getBoundingClientRect();
    if (backdropPress && event.target === dialog && (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom)) dialog.close();
    backdropPress = false;
  });
  dialog.addEventListener('close', () => {
    document.body.classList.remove('dialog-open');
    lastProjectTrigger?.focus({ preventScroll: true });
    syncAmbientPlayback();
  });
  $('.dialog-contact').addEventListener('click', event => {
    event.preventDefault();
    dialog.close();
    // Wait for native dialog focus restoration before moving to the contact section.
    requestAnimationFrame(() => {
      const contact = $('#contact');
      contact.setAttribute('tabindex', '-1');
      contact.focus({ preventScroll: true });
      contact.scrollIntoView({ behavior: root.dataset.motion === 'on' ? 'smooth' : 'auto' });
      contact.addEventListener('blur', () => contact.removeAttribute('tabindex'), { once: true });
    });
  });

  // Indicate the section in view without altering browser anchor navigation.
  if ('IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        const link = $(`.desktop-nav a[href="#${entry.target.id}"]`);
        if (!link) return;
        if (entry.isIntersecting) {
          $$('.desktop-nav a').forEach(item => item.removeAttribute('aria-current'));
          link.setAttribute('aria-current', 'location');
        } else {
          link.removeAttribute('aria-current');
        }
      });
    }, { rootMargin: '-15% 0px -55% 0px', threshold: 0 });
    ['about', 'experiments', 'contact'].forEach(id => sectionObserver.observe($(`#${id}`)));
  }

  function syncAmbientPlayback() {
    const pause = document.hidden || menuOpen || dialog.open;
    ambientTweens.forEach(tween => tween.paused(pause));
  }
  document.addEventListener('visibilitychange', syncAmbientPlayback);

  function updateMotionUI() {
    const enabled = preferredMotion && !reduceMotion.matches && hasGSAP;
    root.dataset.motion = enabled ? 'on' : 'off';
    motionButton.setAttribute('aria-pressed', String(enabled));
    motionButton.setAttribute('aria-label', enabled ? 'Pause decorative animations' : 'Enable decorative animations');
    $('.motion-icon').textContent = enabled ? 'Ⅱ' : '▷';
    $('.motion-label').textContent = enabled ? 'MOTION ON' : 'MOTION OFF';
    // An OS reduced-motion preference takes priority over the page toggle.
    motionButton.disabled = reduceMotion.matches || !hasGSAP;
    motionButton.title = reduceMotion.matches ? 'Reduced motion is enabled in your device settings' : !hasGSAP ? 'Animation library unavailable; all content is still accessible' : 'Toggle decorative motion';
    return enabled;
  }

  function configureAnimations() {
    pointerCleanup();
    animationMedia?.revert();
    ambientTweens = [];
    if (!updateMotionUI()) return;

    const { gsap } = window;
    if (hasScrollTrigger) gsap.registerPlugin(window.ScrollTrigger);
    animationMedia = gsap.matchMedia();
    animationMedia.add({
      allowed: '(prefers-reduced-motion: no-preference)',
      finePointer: '(hover: hover) and (pointer: fine)',
      desktop: '(min-width: 761px)'
    }, context => {
      if (!context.conditions.allowed || !preferredMotion) return;
      const intro = gsap.timeline({ defaults: { ease: 'power3.out' } });
      if (firstEntrance && window.scrollY < 100 && !window.location.hash) {
        intro.from('.site-header', { autoAlpha: 0, y: -18, duration: .85 })
          .from('.hero-topline', { autoAlpha: 0, y: 12, duration: .7 }, .2)
          .from('.headline-line', { yPercent: 115, rotate: 2, duration: 1.25, stagger: .15 }, .3)
          .from('.hero-description', { autoAlpha: 0, y: 20, duration: .85 }, .85)
          .from('.hero-action', { autoAlpha: 0, y: 15, duration: .85 }, 1.02)
          .from('.orb-reveal', { autoAlpha: 0, scale: .76, rotate: -12, duration: 1.9, ease: 'power2.out' }, .25)
          .from('.scene-label, .scene-cross, .star', { autoAlpha: 0, duration: .9, stagger: .055 }, 1.1)
          .from('.hero-bottom', { autoAlpha: 0, duration: .9 }, 1.3);
      }
      firstEntrance = false;
      const ambient = (target, vars) => {
        const tween = gsap.to(target, vars);
        ambientTweens.push(tween);
        return tween;
      };
      ambient('.orb-float', { y: -18, rotation: 2.5, duration: 5.3, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      ambient('.ring-one', { rotation: 360, duration: 65, repeat: -1, ease: 'none' });
      ambient('.ring-two', { rotation: -360, duration: 87, repeat: -1, ease: 'none' });
      ambient('.circular-type', { rotation: 360, duration: 32, repeat: -1, ease: 'none' });
      ambient('.orb-satellite', { y: 12, x: -7, duration: 4.2, repeat: -1, yoyo: true, ease: 'sine.inOut' });
      $$('.star').forEach((star, index) => {
        ambient(star, { y: index % 2 ? 10 : -14, rotation: index % 2 ? -12 : 14, duration: 3.5 + index * 1.1, repeat: -1, yoyo: true, ease: 'sine.inOut', delay: index * .3 });
      });
      ambient('.marquee-track', { xPercent: -50, duration: 38, repeat: -1, ease: 'none' });
      ambient('.about-glyph', { rotation: 360, duration: 55, repeat: -1, ease: 'none' });

      if (hasScrollTrigger) {
        // Hide only elements below the viewport; deep links stay readable.
        $$('.reveal').forEach(element => {
          if (element.getBoundingClientRect().top < window.innerHeight * .97) return;
          gsap.from(element, {
            y: 36, autoAlpha: 0, duration: .95, ease: 'power3.out',
            scrollTrigger: { trigger: element, start: 'top 92%', once: true }
          });
        });
        gsap.to('.manifesto-orbit', {
          rotation: -8, ease: 'none',
          scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'bottom top', scrub: 1.5 }
        });
        gsap.to('.manifesto-asterisk', {
          rotation: 100, y: 35, ease: 'none',
          scrollTrigger: { trigger: '.manifesto', start: 'top bottom', end: 'bottom top', scrub: 1.2 }
        });
      }

      // Small pointer response; no cursor replacement, scroll hijacking, or touch capture.
      if (context.conditions.finePointer && context.conditions.desktop) {
        const hero = $('.hero');
        const moveX = gsap.quickTo('.orb-parallax', 'x', { duration: 1.1, ease: 'power3.out' });
        const moveY = gsap.quickTo('.orb-parallax', 'y', { duration: 1.1, ease: 'power3.out' });
        const move = event => {
          const box = hero.getBoundingClientRect();
          moveX(((event.clientX - box.left) / box.width - .5) * 22);
          moveY(((event.clientY - box.top) / box.height - .5) * 18);
        };
        const reset = () => { moveX(0); moveY(0); };
        hero.addEventListener('pointermove', move, { passive: true });
        hero.addEventListener('pointerleave', reset);
        pointerCleanup = () => {
          hero.removeEventListener('pointermove', move);
          hero.removeEventListener('pointerleave', reset);
        };
      }
      syncAmbientPlayback();
      return () => {
        pointerCleanup();
        pointerCleanup = () => {};
        ambientTweens = [];
      };
    });
    if (hasScrollTrigger) window.ScrollTrigger.refresh();
  }

  motionButton.addEventListener('click', () => {
    preferredMotion = !preferredMotion;
    try { localStorage.setItem('aura-motion', preferredMotion ? 'on' : 'off'); } catch (_) {}
    configureAnimations();
  });
  reduceMotion.addEventListener('change', configureAnimations);
  configureAnimations();

  // Font metrics can change wrapping and therefore ScrollTrigger positions.
  document.fonts?.ready.then(() => {
    if (hasScrollTrigger) window.ScrollTrigger.refresh();
    updateScrollUI();
  });
})();
