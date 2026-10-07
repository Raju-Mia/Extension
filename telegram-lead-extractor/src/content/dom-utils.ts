/**
 * Small, dependency-free DOM helpers. These centralize waiting, selector
 * fallbacks, and scrolling so scanner/parser code stays readable.
 */

export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Try each selector in order, returning the first matched element. */
export function queryFirst(selectors: readonly string[], root: ParentNode = document): HTMLElement | null {
  for (const sel of selectors) {
    try {
      const el = root.querySelector<HTMLElement>(sel);
      if (el) return el;
    } catch {
      // Ignore invalid selector strings from a Telegram UI change.
    }
  }
  return null;
}

/** Try each selector in order, returning all matched elements from the first hit. */
export function queryAll(selectors: readonly string[], root: ParentNode = document): HTMLElement[] {
  for (const sel of selectors) {
    try {
      const nodes = Array.from(root.querySelectorAll<HTMLElement>(sel));
      if (nodes.length) return nodes;
    } catch {
      // Skip broken selector.
    }
  }
  return [];
}

/** Query a single selector within an optional root (returns all matches). */
export function querySelectorAllSafe(selector: string, root: ParentNode = document): HTMLElement[] {
  try {
    return Array.from(root.querySelectorAll<HTMLElement>(selector));
  } catch {
    return [];
  }
}

/** Poll for an element matching any selector until timeout. */
export async function waitForElement(
  selectors: readonly string[],
  timeout = 8000,
  root: ParentNode = document,
): Promise<HTMLElement | null> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const el = queryFirst(selectors, root);
    if (el) return el;
    await wait(150);
  }
  return null;
}

/**
 * Resolve when the container mutates (childList/subtree) or after a timeout.
 * Used to wait for virtualized list re-renders after a scroll.
 */
export function waitForMutation(container: HTMLElement, timeout = 3000): Promise<void> {
  return new Promise((resolve) => {
    const observer = new MutationObserver(() => {
      observer.disconnect();
      resolve();
    });
    observer.observe(container, { childList: true, subtree: true });
    setTimeout(() => {
      observer.disconnect();
      resolve();
    }, timeout);
  });
}

/** Dispatch a realistic sequence of pointer/mouse events for a normal click. */
export function simulateClick(el: HTMLElement): void {
  const rects = el.getBoundingClientRect?.() ?? null;
  const x = rects ? rects.left + rects.width / 2 : 0;
  const y = rects ? rects.top + rects.height / 2 : 0;
  const common = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
  el.dispatchEvent(new PointerEvent("pointerdown", { ...common, pointerId: 1, isPrimary: true, pointerType: "mouse", button: 0 }));
  el.dispatchEvent(new MouseEvent("mousedown", common));
  el.dispatchEvent(new PointerEvent("pointerup", { ...common, pointerId: 1, isPrimary: true, pointerType: "mouse", button: 0 }));
  el.dispatchEvent(new MouseEvent("mouseup", common));
  el.dispatchEvent(new MouseEvent("click", common));
}

/**
 * Scroll a container down by a fraction of its viewport (default 0.7). Using
 * less than a full page keeps an overlap so virtualized lists that render rows
 * lazily are never skipped between jumps. Returns true if it actually moved.
 */
export function scrollContainerByStep(container: HTMLElement, ratio = 0.7): boolean {
  const before = container.scrollTop;
  const step = Math.max(Math.floor(container.clientHeight * ratio), 120);
  container.scrollTop = before + step;
  return container.scrollTop > before;
}

/** Whether the container is scrolled to (or near) the bottom. */
export function isAtBottom(container: HTMLElement): boolean {
  const tolerance = 4;
  return container.scrollTop + container.clientHeight >= container.scrollHeight - tolerance;
}

/** Find the nearest scrollable ancestor (or the element itself) for a list. */
export function findScrollable(el: HTMLElement): HTMLElement {
  let node: HTMLElement | null = el;
  while (node && node !== document.body) {
    const style = getComputedStyle(node);
    const overflowY = style.overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight + 4) {
      return node;
    }
    node = node.parentElement;
  }
  return el;
}

/** Collapse an element's text content into single-spaced, trimmed text. */
export function visibleText(el: HTMLElement | null): string {
  if (!el) return "";
  return (el.textContent ?? "").replace(/\s+/g, " ").trim();
}
