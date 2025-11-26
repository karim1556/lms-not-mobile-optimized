"use client";

import React, { useEffect, useRef, useState } from "react";

type Props = { src: string };

export default function ExternalVideoPlayer({ src }: Props) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    let hls: any = null;
    const video = ref.current;
    if (!video) return;

    const onMeta = () => {
      if (video.videoWidth && video.videoHeight) {
        setRatio(video.videoHeight / video.videoWidth);
      }
    };

    video.addEventListener("loadedmetadata", onMeta);

    const isHls = /\.m3u8(\?|$)/i.test(src);

    if (isHls) {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(src);
            hls.attachMedia(video);
          } else {
            video.src = src;
          }
        })
        .catch(() => {
          video.src = src;
        });
    } else {
      video.src = src;
    }

    return () => {
      video.removeEventListener("loadedmetadata", onMeta);
      if (hls) {
        try {
          hls.destroy();
        } catch {}
      }
    };
  }, [src]);

  // Use a responsive 16:9 container (like YouTube) so video scales with width
  return (
    <div style={{ width: '100%', display: 'block' }}>
      <div style={{ width: '100%', aspectRatio: '16/9', maxHeight: '80vh', background: 'black', position: 'relative' }}>
        <video
          ref={ref}
          controls
          playsInline
          controlsList="nodownload nofullscreen noremoteplayback"
          disablePictureInPicture
          onContextMenu={(e) => e.preventDefault()}
          preload="metadata"
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', background: 'black', display: 'block' }}
        />
      </div>
    </div>
  );
}
