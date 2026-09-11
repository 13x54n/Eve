export type SiteLinks = {
  github: string | null;
  docs: string;
  source: string;
};

export function siteLinks(): SiteLinks {
  const raw = process.env.NEXT_PUBLIC_GITHUB_URL?.trim().replace(/\/$/, "");
  const github = raw || null;
  return {
    github,
    docs: github ? `${github}/blob/main/GETTING_STARTED.md` : "#start",
    source: github ?? "#start",
  };
}
