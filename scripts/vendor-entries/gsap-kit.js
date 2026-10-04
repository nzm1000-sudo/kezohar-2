// GSAP core + ScrollTrigger as one ES module.
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
gsap.registerPlugin(ScrollTrigger);
export { gsap, ScrollTrigger };
