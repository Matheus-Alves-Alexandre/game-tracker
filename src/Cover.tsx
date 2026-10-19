import { useEffect, useRef, useState } from 'react';
import { Gamepad2 } from 'lucide-react';
import { catalogApi } from './library-api';

export default function Cover({
  imageId,
  className = '',
}: {
  imageId?: string | null;
  className?: string;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const [source, setSource] = useState<string | null>(null);
  useEffect(() => {
    setSource(null);
    if (!imageId) return;
    let active = true;
    let observer: IntersectionObserver | undefined;
    const load = () => {
      observer?.disconnect();
      void catalogApi
        .readCover(imageId)
        .then((value) => {
          if (active) setSource(value);
        })
        .catch(() => {});
    };
    if (typeof IntersectionObserver === 'undefined') load();
    else {
      observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) load();
        },
        { rootMargin: '150px' },
      );
      if (holder.current) observer.observe(holder.current);
    }
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [imageId]);
  return (
    <div ref={holder} className={`game-cover ${className}`} aria-hidden="true">
      {source ? (
        <img src={source} alt="" onError={() => setSource(null)} />
      ) : (
        <Gamepad2 size={32} strokeWidth={1.4} />
      )}
    </div>
  );
}
