/* ==========================================
   כזוהר הרקיע - Main JavaScript
   ========================================== */

(function() {
    'use strict';

    // ==========================================
    // Initialize AOS Animations
    // ==========================================
    document.addEventListener('DOMContentLoaded', function() {
        if (typeof AOS !== 'undefined') {
            AOS.init({
                duration: 800,
                once: true,
                offset: 80,
                easing: 'ease-out-cubic'
            });
        }
        
        initNavbar();
        initMobileMenu();
        initSmoothScroll();
        initCounters();
        initCopyButtons();
        initFloatingDonate();
        initCurrentYear();
        initThemeToggle();
        initImageModal();
        initActiveNavigation();
    });

    // ==========================================
    // Navbar - Sticky Shadow on Scroll
    // ==========================================
    function initNavbar() {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;

        let lastScroll = 0;
        window.addEventListener('scroll', function() {
            const currentScroll = window.pageYOffset;
            if (currentScroll > 20) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
            lastScroll = currentScroll;
        }, { passive: true });
    }

    // ==========================================
    // Mobile Menu Toggle
    // ==========================================
    function initMobileMenu() {
        const menuToggle = document.getElementById('menuToggle');
        const navMenu = document.getElementById('navMenu');
        if (!menuToggle || !navMenu) return;

        menuToggle.addEventListener('click', function() {
            const isOpen = navMenu.classList.toggle('active');
            menuToggle.classList.toggle('active', isOpen);
            menuToggle.setAttribute('aria-expanded', String(isOpen));
            menuToggle.setAttribute('aria-label', isOpen ? 'סגירת תפריט' : 'פתיחת תפריט');
        });

        // Close menu when clicking a link
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                menuToggle.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                menuToggle.setAttribute('aria-label', 'פתיחת תפריט');
            });
        });

        // Close on outside click
        document.addEventListener('click', function(e) {
            if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                navMenu.classList.remove('active');
                menuToggle.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
                menuToggle.setAttribute('aria-label', 'פתיחת תפריט');
            }
        });
    }

    // ==========================================
    // Smooth Scroll to anchors
    // ==========================================
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                const href = this.getAttribute('href');
                if (href === '#' || href === '') return;
                
                const target = document.querySelector(href);
                if (target) {
                    e.preventDefault();
                    const offset = 80;
                    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - offset;
                    window.scrollTo({
                        top: targetPosition,
                        behavior: 'smooth'
                    });
                }
            });
        });
    }

    // ==========================================
    // Animated Counters
    // ==========================================
    function initCounters() {
        const counters = document.querySelectorAll('.counter');
        if (!counters.length) return;

        const observer = new IntersectionObserver(function(entries) {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    animateCounter(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.5 });

        counters.forEach(counter => observer.observe(counter));
    }

    function animateCounter(element) {
        const target = parseInt(element.getAttribute('data-target'));
        const duration = 1800;
        const startTime = performance.now();
        
        function update(currentTime) {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeOut = 1 - Math.pow(1 - progress, 3);
            const current = Math.floor(target * easeOut);
            element.textContent = current;
            
            if (progress < 1) {
                requestAnimationFrame(update);
            } else {
                element.textContent = target;
            }
        }
        
        requestAnimationFrame(update);
    }

    // ==========================================
    // Copy to Clipboard
    // ==========================================
    function initCopyButtons() {
        const copyButtons = document.querySelectorAll('.copy-btn');
        copyButtons.forEach(btn => {
            btn.addEventListener('click', function(e) {
                e.preventDefault();
                const textToCopy = this.getAttribute('data-copy');
                copyToClipboard(textToCopy);
                showToast('מספר החשבון הועתק בהצלחה!');
            });
        });
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
        } catch (err) {
            console.error('Copy failed', err);
        }
        document.body.removeChild(textarea);
    }

    // ==========================================
    // Toast Notification
    // ==========================================
    function showToast(message) {
        const toast = document.getElementById('toast');
        const toastMessage = document.getElementById('toastMessage');
        if (!toast) return;
        
        if (toastMessage) toastMessage.textContent = message;
        toast.classList.add('show');
        
        clearTimeout(toast._timeout);
        toast._timeout = setTimeout(() => {
            toast.classList.remove('show');
        }, 2800);
    }

    // ==========================================
    // Floating Donate Button - Show after scroll
    // ==========================================
    function initFloatingDonate() {
        const floatingBtn = document.getElementById('floatingDonate');
        if (!floatingBtn) return;

        const donateSection = document.getElementById('donate');
        
        window.addEventListener('scroll', function() {
            const scrolled = window.pageYOffset;
            const windowHeight = window.innerHeight;
            
            // Show after scrolling past the hero
            if (scrolled > windowHeight * 0.8) {
                // Hide when donate section is visible
                if (donateSection) {
                    const donateRect = donateSection.getBoundingClientRect();
                    if (donateRect.top < windowHeight && donateRect.bottom > 0) {
                        floatingBtn.classList.remove('visible');
                    } else {
                        floatingBtn.classList.add('visible');
                    }
                } else {
                    floatingBtn.classList.add('visible');
                }
            } else {
                floatingBtn.classList.remove('visible');
            }
        }, { passive: true });
    }

    // ==========================================
    // Theme preference — honours system choice, remembers explicit choice
    // ==========================================
    function initThemeToggle() {
        const toggle = document.getElementById('themeToggle');
        if (!toggle) return;
        const stored = localStorage.getItem('kezohar-theme');
        const isDark = stored === 'dark';
        setTheme(isDark);
        toggle.addEventListener('click', () => {
            const next = !document.body.classList.contains('dark-mode');
            setTheme(next);
            localStorage.setItem('kezohar-theme', next ? 'dark' : 'light');
        });
        function setTheme(dark) {
            document.body.classList.toggle('dark-mode', dark);
            toggle.setAttribute('aria-pressed', String(dark));
            toggle.setAttribute('aria-label', dark ? 'מעבר למצב בהיר' : 'מעבר למצב כהה');
            toggle.querySelector('i').className = dark ? 'fas fa-sun' : 'fas fa-moon';
        }
    }

    // ==========================================
    // Accessible image dialog (Escape + backdrop close + focus return)
    // ==========================================
    function initImageModal() {
        const modal = document.getElementById('rav-modal');
        const trigger = document.querySelector('.rav-trigger');
        const close = modal && modal.querySelector('.modal-close');
        if (!modal || !trigger || !close) return;
        const closeModal = () => { modal.hidden = true; trigger.focus(); };
        trigger.addEventListener('click', () => { modal.hidden = false; close.focus(); });
        close.addEventListener('click', closeModal);
        modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
        document.addEventListener('keydown', event => { if (event.key === 'Escape' && !modal.hidden) closeModal(); });
    }

    // ==========================================
    // Current location indicator in one-page navigation
    // ==========================================
    function initActiveNavigation() {
        const links = [...document.querySelectorAll('.nav-menu a')];
        const sections = links.map(link => document.querySelector(link.getAttribute('href'))).filter(Boolean);
        if (!sections.length || !('IntersectionObserver' in window)) return;
        const observer = new IntersectionObserver(entries => {
            const active = entries.filter(entry => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (!active) return;
            links.forEach(link => link.removeAttribute('aria-current'));
            const link = links.find(item => item.getAttribute('href') === '#' + active.target.id);
            if (link) link.setAttribute('aria-current', 'page');
        }, { rootMargin: '-35% 0px -55% 0px', threshold: [0, .1, .25] });
        sections.forEach(section => observer.observe(section));
    }

    // ==========================================
    // Current Year in Footer
    // ==========================================
    function initCurrentYear() {
        const yearEl = document.getElementById('currentYear');
        if (yearEl) {
            yearEl.textContent = new Date().getFullYear();
        }
    }

})();
