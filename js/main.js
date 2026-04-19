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
            navMenu.classList.toggle('active');
            menuToggle.classList.toggle('active');
        });

        // Close menu when clicking a link
        navMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', function() {
                navMenu.classList.remove('active');
                menuToggle.classList.remove('active');
            });
        });

        // Close on outside click
        document.addEventListener('click', function(e) {
            if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                navMenu.classList.remove('active');
                menuToggle.classList.remove('active');
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
    // Current Year in Footer
    // ==========================================
    function initCurrentYear() {
        const yearEl = document.getElementById('currentYear');
        if (yearEl) {
            yearEl.textContent = new Date().getFullYear();
        }
    }

})();
