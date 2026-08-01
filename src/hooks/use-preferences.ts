import { useCallback, useEffect, useState } from "react";

const TAGS_KEY = "pulse.followed-tags";
const HIDE_LIKES_KEY = "pulse.hide-likes";
const EVENT = "pulse:prefs";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage unavailable */
  }
  window.dispatchEvent(new Event(EVENT));
}

function useStored<T>(key: string, fallback: T) {
  // Start from the fallback so SSR and first client render match.
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    const sync = () => setValue(read<T>(key, fallback));
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      write(key, next);
    },
    [key],
  );

  return [value, set] as const;
}

export function useFollowedTags() {
  const [tags, setTags] = useStored<string[]>(TAGS_KEY, []);

  const isFollowing = useCallback(
    (tag: string) => tags.some((t) => t.toLowerCase() === tag.toLowerCase()),
    [tags],
  );

  const toggleTag = useCallback(
    (tag: string) => {
      const lower = tag.toLowerCase();
      setTags(
        tags.some((t) => t.toLowerCase() === lower)
          ? tags.filter((t) => t.toLowerCase() !== lower)
          : [...tags, tag],
      );
    },
    [tags, setTags],
  );

  return { tags, isFollowing, toggleTag };
}

export function useHideLikes() {
  const [hideLikes, setHideLikes] = useStored<boolean>(HIDE_LIKES_KEY, false);
  return { hideLikes, setHideLikes };
}
