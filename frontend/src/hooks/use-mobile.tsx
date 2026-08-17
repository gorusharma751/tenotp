import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function readIsMobile(): boolean {
  if (typeof window === "undefined") return false;
  return window.innerWidth < MOBILE_BREAKPOINT;
}

export function useIsMobile() {
  // SSR renders with `false` so client hydration matches; a layout effect
  // then flips the value synchronously before paint on narrow viewports so
  // the sidebar renders as a mobile Sheet instead of the hidden desktop rail.
  const [isMobile, setIsMobile] = React.useState<boolean>(false);

  React.useLayoutEffect(() => {
    setIsMobile(readIsMobile());
  }, []);

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(readIsMobile());
    mql.addEventListener("change", onChange);
    window.addEventListener("resize", onChange);
    window.addEventListener("orientationchange", onChange);
    return () => {
      mql.removeEventListener("change", onChange);
      window.removeEventListener("resize", onChange);
      window.removeEventListener("orientationchange", onChange);
    };
  }, []);

  return isMobile;
}
