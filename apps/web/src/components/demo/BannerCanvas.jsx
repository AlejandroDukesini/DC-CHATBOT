import { useEffect, useRef } from 'react';
import { BANNER_SIZE, drawBanner } from '@dc-chatbot/core';

/** Dibuja el banner con exactamente la misma función que usa el bot en el servidor. */
export function BannerCanvas({ spec }) {
  const ref = useRef(null);

  useEffect(() => {
    const ctx = ref.current?.getContext?.('2d');
    if (ctx) drawBanner(ctx, spec);
  }, [spec]);

  return (
    <canvas
      ref={ref}
      width={BANNER_SIZE.width}
      height={BANNER_SIZE.height}
      role="img"
      aria-label={`Banner de bienvenida de ${spec.username}`}
      className="mt-1.5 aspect-[1024/360] w-full max-w-md rounded-md"
    />
  );
}
