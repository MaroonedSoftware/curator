import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

import '@testing-library/jest-dom/vitest';

// Testing Library only self-registers cleanup when vitest runs with `globals: true`, which this
// package does not, so renders would otherwise pile up in one document.
afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
});

configure({ asyncUtilTimeout: 5_000 });

// jsdom implements none of these, and Mantine components use them.
Object.defineProperty(window, 'matchMedia', {
    writable: true,
    configurable: true,
    value: (query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
    }),
});

class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
}

window.ResizeObserver = ResizeObserverStub;

// The router restores scroll on navigation; jsdom has no scrolling at all.
window.scrollTo = () => {};
Element.prototype.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};
