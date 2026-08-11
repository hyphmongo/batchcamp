const DOWNLOAD_SEGMENT = "/download/";
const STAT_SEGMENT = "/statdownload/";

const CALLBACK = /statResult\s*\(\s*([\s\S]*?)\s*\)\s*;?\s*\}?\s*;?\s*$/;

export type StatOutcome =
  | { readonly _tag: "Ready" }
  | { readonly _tag: "Rejected"; readonly errortype: string }
  | { readonly _tag: "Unreadable" };

const UNREADABLE: StatOutcome = { _tag: "Unreadable" };

export const toStatUrl = (downloadUrl: string): string | null => {
  let url: URL;

  try {
    url = new URL(downloadUrl);
  } catch {
    return null;
  }

  if (!url.pathname.includes(DOWNLOAD_SEGMENT)) {
    return null;
  }

  url.pathname = url.pathname.replace(DOWNLOAD_SEGMENT, STAT_SEGMENT);
  url.searchParams.set(".rand", String(Math.floor(Math.random() * 1e12)));
  url.searchParams.set(".vrs", "1");

  return url.toString();
};

export const parseStatResponse = (body: string): StatOutcome => {
  const payload = body.match(CALLBACK)?.[1];

  if (!payload) {
    return UNREADABLE;
  }

  try {
    const { result, errortype } = JSON.parse(payload) as {
      result?: string;
      errortype?: string;
    };

    return result === "ok"
      ? { _tag: "Ready" }
      : { _tag: "Rejected", errortype: errortype ?? "unknown" };
  } catch {
    return UNREADABLE;
  }
};

export const queryStatDownload = async (
  downloadUrl: string,
): Promise<StatOutcome> => {
  const statUrl = toStatUrl(downloadUrl);

  if (!statUrl) {
    return UNREADABLE;
  }

  try {
    const response = await fetch(statUrl);
    return parseStatResponse(await response.text());
  } catch {
    return UNREADABLE;
  }
};
