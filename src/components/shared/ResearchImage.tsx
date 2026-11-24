import { useState } from 'react';
import { Cpu } from 'lucide-react';

interface ResearchImageProps {
  src: string;
  alt: string;
  caption?: string;
  aspectClass?: string;
  className?: string;
}

export function ResearchImage({
  src,
  alt,
  caption,
  aspectClass = 'aspect-video',
  className = '',
}: ResearchImageProps) {
  const [failed, setFailed] = useState(false);

  return (
    <figure className={`relative overflow-hidden bg-[#0B0E17] ${aspectClass} ${className}`}>
      {!failed ? (
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-[#0B0E17] via-[#0F172A] to-[#07090E] p-6 text-center">
          <Cpu className="h-7 w-7 text-[#38BDF8]/70" />
          <span className="font-mono text-xs text-slate-400">{caption || alt}</span>
        </div>
      )}
      {caption && (
        <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-4 pb-3 pt-8 text-xs text-slate-200">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
