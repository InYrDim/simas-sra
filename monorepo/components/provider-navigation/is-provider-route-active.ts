export function isProviderRouteActive(pathname: string, href: string, exactMatch: boolean = false): boolean {
  const currentPath = pathname.split("?", 1)[0].replace(/\/$/, "") || "/";
  const targetPath = href.replace(/\/$/, "") || "/";

  if (targetPath === "/provider" || exactMatch) {
    return currentPath === targetPath;
  }

  return currentPath === targetPath || currentPath.startsWith(`${targetPath}/`);
}
