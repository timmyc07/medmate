"use client";

import { useEffect, useRef, type ReactNode } from "react";

type RevealElement = "article" | "aside" | "div" | "section";

let observer: IntersectionObserver | null = null;
const observed = new Set<Element>();

function observeOnce(element: Element): () => void {
  if (!observer) {
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.remove("is-pending");
        entry.target.classList.add("is-revealed");
        observed.delete(entry.target);
        observer?.unobserve(entry.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
  }
  observed.add(element);
  observer.observe(element);
  return () => {
    observed.delete(element);
    observer?.unobserve(element);
    if (!observed.size) {
      observer?.disconnect();
      observer = null;
    }
  };
}

export default function ScrollReveal({
  as: Element = "div",
  className,
  children,
  id,
  ariaLabelledby,
}: {
  as?: RevealElement;
  className: string;
  children: ReactNode;
  id?: string;
  ariaLabelledby?: string;
}) {
  const elementRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = elementRef.current;
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!element || reducedMotion || !("IntersectionObserver" in window)) return;
    element.classList.add("is-pending");
    return observeOnce(element);
  }, []);
  return <Element ref={(element) => { elementRef.current = element; }} id={id} aria-labelledby={ariaLabelledby} className={`scroll-reveal ${className}`} data-scroll-reveal="">{children}</Element>;
}
