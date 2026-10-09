import "@testing-library/jest-dom/vitest";

// jsdom lacks these; stub so components relying on them don't crash in tests.
if (!("randomUUID" in crypto)) {
  // @ts-expect-error test shim
  crypto.randomUUID = () => "test-client-id";
}

if (!window.matchMedia) {
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
