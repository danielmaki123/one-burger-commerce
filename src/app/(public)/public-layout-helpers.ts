export function getPublicHeaderClassName() {
  return "sticky top-0 z-50 hidden w-full border-b border-border bg-background/88 backdrop-blur-md md:block";
}

export function getPublicFooterClassName() {
  return "hidden border-t border-border bg-secondary/60 md:block";
}

export function getPublicMobileInfoFooterClassName() {
  return "hidden";
}

export function shouldRenderPublicMobileBottomNav(pathname: string) {
  return !/^\/menu\/[^/]+$/.test(pathname);
}
