"use client";

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Play, LayoutDashboard } from 'lucide-react';
import ExternalVideoPlayer from '@/components/ui/external-video-player';

type LessonType = 'lesson' | 'quiz' | 'assignment' | 'video' | 'document' | 'video_file';
interface Lesson { id: string; title: string; description?: string; type?: LessonType; duration?: number; completed?: boolean; video_url?: string; file_url?: string; attachment_url?: string }
interface Section { id: string; title: string; lessons: Lesson[] }

export default function CourseMainClient({ initialCurriculum, courseId, role = 'student', studentId, trainerId, batchId }: { initialCurriculum: Section[]; courseId: string; role?: 'student'|'trainer'; studentId?: string; trainerId?: string; batchId?: string }) {
  // Fetch persisted completions for this course/role and apply to curriculum
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const params = new URLSearchParams();
        params.set('courseId', String(courseId));
        params.set('role', role);
        if (role === 'student') {
          if (!studentId || !batchId) return;
          params.set('studentId', String(studentId));
          params.set('batchId', String(batchId));
        } else {
          if (!trainerId) return;
          params.set('trainerId', String(trainerId));
        }
        const res = await fetch(`/api/progress/lessons?${params.toString()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = await res.json();
        const completedIds = new Set((data?.completedLessonIds || []).map((x: any) => String(x)));
        if (!active) return;
        setCurriculum((prev) => prev.map(s => ({ ...s, lessons: s.lessons.map(l => ({ ...l, completed: completedIds.has(String(l.id)) })) })));
      } catch (e) {}
    })();
    return () => { active = false };
  }, [courseId, role, studentId, trainerId, batchId]);
  const router = useRouter();
  const [curriculum, setCurriculum] = useState<Section[]>(initialCurriculum || []);
  const allLessons = curriculum.flatMap(s => s.lessons || []);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  // Helper: queue key for pending completions when owner identifiers are not yet available
  const pendingQueueKey = `ai-skool:pendingCompletions:${String(courseId)}`;

  // Owner identifiers may be broadcast by a wrapper (sidebar) via `owner:resolved` event
  // to support multiple sources of truth (props or wrapper). Listen and cache them.
  const [ownerRole, setOwnerRole] = useState<typeof role | undefined>(role);
  const [ownerStudentId, setOwnerStudentId] = useState<string | undefined>(studentId);
  const [ownerTrainerId, setOwnerTrainerId] = useState<string | undefined>(trainerId);
  const [ownerBatchId, setOwnerBatchId] = useState<string | undefined>(batchId);

  useEffect(() => {
    const onResolved = (ev: any) => {
      const d = ev.detail || {};
      if (d.role) setOwnerRole(d.role);
      if (d.studentId) setOwnerStudentId(String(d.studentId));
      if (d.trainerId) setOwnerTrainerId(String(d.trainerId));
      if (d.batchId) setOwnerBatchId(String(d.batchId));
    };
    window.addEventListener('owner:resolved', onResolved as EventListener);
    return () => window.removeEventListener('owner:resolved', onResolved as EventListener);
  }, []);

  // Also sync owner state from props when they arrive after mount
  useEffect(() => {
    if (!ownerRole && role) setOwnerRole(role);
    if (!ownerStudentId && studentId) setOwnerStudentId(studentId);
    if (!ownerBatchId && batchId) setOwnerBatchId(batchId);
    if (!ownerTrainerId && trainerId) setOwnerTrainerId(trainerId);
  }, [studentId, trainerId, batchId, role]);

  // Persist a completion safely: if owner identifiers are present, POST to API,
  // otherwise enqueue to localStorage for later flushing.
  const persistLessonCompletion = async (lessonId: string) => {
    if (!lessonId) return;
    // prefer owner- resolved identifiers when available (they may arrive via event)
    const effectiveRole = ownerRole || role;
    const effectiveStudentId = ownerStudentId || studentId;
    const effectiveBatchId = ownerBatchId || batchId;
    const effectiveTrainerId = ownerTrainerId || trainerId;

    const shouldQueueForStudent = effectiveRole === 'student' && (!effectiveStudentId || !effectiveBatchId);
    const shouldQueueForTrainer = effectiveRole === 'trainer' && !effectiveTrainerId;

    if (shouldQueueForStudent || shouldQueueForTrainer) {
      // enqueue if not already present
      try {
        const raw = localStorage.getItem(pendingQueueKey) || '[]';
        const arr: string[] = JSON.parse(raw);
        if (!arr.includes(lessonId)) {
          arr.push(lessonId);
          localStorage.setItem(pendingQueueKey, JSON.stringify(arr));
        }
      } catch (e) {}
      return;
    }
    // Build payload with available owner identifiers
    const payload: any = {
      course_id: courseId,
      lesson_id: lessonId,
      completed: true,
      role: effectiveRole,
    };
    if (effectiveRole === 'student') {
      if (effectiveStudentId) payload.student_id = effectiveStudentId;
      if (effectiveBatchId) payload.batch_id = effectiveBatchId;
    } else if (effectiveRole === 'trainer') {
      if (effectiveTrainerId) payload.trainer_id = effectiveTrainerId;
    }

    try {
      const res = await fetch('/api/progress/lessons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        // ensure any queued entry for this lesson is removed
        try {
          const cur = JSON.parse(localStorage.getItem(pendingQueueKey) || '[]') as string[];
          const updated = cur.filter(x => x !== lessonId);
          localStorage.setItem(pendingQueueKey, JSON.stringify(updated));
        } catch (e) {}
        // Broadcast confirmed completion so other components can sync
        try { window.dispatchEvent(new CustomEvent('lesson:completion-confirmed', { detail: { lessonId, completed: true } })); } catch (e) {}
      }
    } catch (e) {
      // On network error, enqueue for retry later
      try {
        const raw = localStorage.getItem(pendingQueueKey) || '[]';
        const arr: string[] = JSON.parse(raw);
        if (!arr.includes(lessonId)) {
          arr.push(lessonId);
          localStorage.setItem(pendingQueueKey, JSON.stringify(arr));
        }
      } catch (e) {}
    }
  };

  // Flush any pending completions when owner identifiers become available
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let active = true;
    (async () => {
      try {
        const raw = localStorage.getItem(pendingQueueKey) || '[]';
        const arr: string[] = JSON.parse(raw || '[]');
        if (!arr.length) return;

        // Use owner-resolved identifiers when available
        const effectiveRole = ownerRole || role;
        const effectiveStudentId = ownerStudentId || studentId;
        const effectiveBatchId = ownerBatchId || batchId;
        const effectiveTrainerId = ownerTrainerId || trainerId;

        // Only attempt flush if relevant owner info exists
        if (effectiveRole === 'student' && (!effectiveStudentId || !effectiveBatchId)) return;
        if (effectiveRole === 'trainer' && !effectiveTrainerId) return;

        for (const lessonId of arr) {
          if (!active) return;
          try {
            const payload: any = {
              course_id: courseId,
              lesson_id: lessonId,
              completed: true,
              role: effectiveRole,
            };
            if (effectiveRole === 'student') {
              if (effectiveStudentId) payload.student_id = effectiveStudentId;
              if (effectiveBatchId) payload.batch_id = effectiveBatchId;
            } else if (effectiveRole === 'trainer') {
              if (effectiveTrainerId) payload.trainer_id = effectiveTrainerId;
            }
            const res = await fetch('/api/progress/lessons', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload),
            });
            if (res.ok) {
              // remove from queue
              const cur = JSON.parse(localStorage.getItem(pendingQueueKey) || '[]') as string[];
              const updated = cur.filter(x => x !== lessonId);
              localStorage.setItem(pendingQueueKey, JSON.stringify(updated));
              // broadcast confirmed completion
              try { window.dispatchEvent(new CustomEvent('lesson:completion-confirmed', { detail: { lessonId, completed: true } })); } catch (e) {}
            }
          } catch (e) {
            // if one fails, continue to next
          }
        }
      } catch (e) {}
    })();
    return () => { active = false };
  }, [studentId, batchId, trainerId, courseId, role, ownerRole, ownerStudentId, ownerTrainerId, ownerBatchId]);

  useEffect(() => {
    const current = allLessons.find(l => !l.completed) || allLessons[0];
    if (current && !selectedLessonId) setSelectedLessonId(current.id);
  }, [curriculum]);

  // If a lessonId is present in the URL (for example after completing a quiz
  // we navigate back to playback with ?lessonId=...), honor that by selecting
  // the lesson and broadcasting the selection so the sidebar updates.
  useEffect(() => {
    try {
      const sp = new URLSearchParams(window.location.search);
      const lessonIdFromUrl = sp.get('lessonId');
      if (lessonIdFromUrl) {
        setSelectedLessonId(lessonIdFromUrl);
        window.dispatchEvent(new CustomEvent('lesson:selected', { detail: { lessonId: lessonIdFromUrl } }));
      }
    } catch (e) {
      // ignore
    }
  }, []);

  useEffect(() => {
    const onSelect = (ev: any) => {
      const { lessonId } = ev.detail || {};
      if (!lessonId) return;
      setSelectedLessonId(lessonId);
    };

    const onChange = (ev: any) => {
      const { lessonId, completed } = ev.detail || {};
      if (!lessonId) return;
      setCurriculum(prev => prev.map(s => ({ ...s, lessons: s.lessons.map(l => l.id === lessonId ? { ...l, completed } : l) } )));
    };

    window.addEventListener('lesson:selected', onSelect as EventListener);
    window.addEventListener('lesson:completion-changed', onChange as EventListener);
    window.addEventListener('lesson:completion-confirmed', onChange as EventListener);

    return () => {
      window.removeEventListener('lesson:selected', onSelect as EventListener);
      window.removeEventListener('lesson:completion-changed', onChange as EventListener);
      window.removeEventListener('lesson:completion-confirmed', onChange as EventListener);
    };
  }, []);

  const selectedLesson = allLessons.find(l => l.id === selectedLessonId) || allLessons[0];
  const currentIndex = allLessons.findIndex(l => l.id === selectedLesson?.id);
  const previousLesson = allLessons[currentIndex - 1];
  const nextLesson = allLessons[currentIndex + 1];

  // Intentionally silent in production — do not log selected lesson (may contain signed URLs)

  // Map of lessonId -> resolved absolute playable URL (stream URL or signed URL)
  const [resolvedVideoSrc, setResolvedVideoSrc] = useState<Record<string, string>>({});
  // Map of lessonId -> directUrl resolved from external embed pages (so we can use <video> instead of iframe)
  const [externalDirectSrc, setExternalDirectSrc] = useState<Record<string, string | null>>({});

  // When selectedLesson changes, if it has a relative storage path (courseId/file) try to request
  // a signed token and set a streaming URL. This makes the component resilient when server-side
  // logic hasn't yet exchanged relative paths for stream URLs.
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!selectedLesson) return;
        const raw = String(selectedLesson.video_url || (selectedLesson as any).file_url || '');
        if (!raw) return;

        // If it's already an absolute URL (http/https) or starts with our API path, nothing to do
        if (/^https?:\/\//i.test(raw) || /^\/?api\//i.test(raw)) return;

        // Otherwise assume it's a relative protected path like "<courseId>/<file>"
        const protectedPath = raw.replace(/^\/+/, '');
        console.log('course-main: resolving protected path', protectedPath);
        const res = await fetch('/api/media/get-signed-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: protectedPath }),
        });
        if (!active) return;
        if (!res.ok) {
          console.warn('course-main: token request failed', await res.text());
          return;
        }
        const body = await res.json();
        if (!body?.token) return;
        const origin = typeof window !== 'undefined' ? window.location.origin : '';
        const abs = `${origin}/api/media/stream?token=${encodeURIComponent(body.token)}`;
        if (!active) return;
        setResolvedVideoSrc(prev => ({ ...prev, [String(selectedLesson.id)]: abs }));
      } catch (e) {
        console.warn('course-main: failed to resolve protected video', e);
      }
    })();
    return () => { active = false };
  }, [selectedLesson?.id, selectedLesson?.video_url, selectedLesson?.file_url]);

  // Fullscreen mode for the lesson player
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isFullscreen]);

  const getLessonTypeLabel = (type?: LessonType) => {
    switch (type) {
      case 'video': case 'video_file': return 'Video Lesson';
      case 'quiz': return 'Quiz';
      case 'assignment': return 'Assignment';
      case 'document': return 'Document';
      default: return 'Lesson';
    }
  };

  // Infer a display label for lessons where `type` may be missing or inconsistent
  const inferDisplayLabel = (lesson?: Lesson) => {
    if (!lesson) return 'Lesson';
    const t = lesson.type;
    if (t) return getLessonTypeLabel(t);

    // If there's no explicit type, infer from available fields
    const desc = String(lesson.description || '');
    const title = String(lesson.title || '');
    const video = String(lesson.video_url || '');

    // Assignment-like: has description/instructions and no embeddable video URL, or title contains 'assign'
    if ((!video || video.trim() === '') && (desc.trim() !== '' || /assign/i.test(title))) return 'Assignment';

    // Document-like: PDF url or file hint
    try {
      if (video.toLowerCase().endsWith('.pdf')) return 'Document';
      if (/\.pdf(\?|$)/i.test(video)) return 'Document';
    } catch (e) {}

    return 'Lesson';
  };

  const onNavigate = (lesson?: Lesson) => {
    if (!lesson) return;
    setSelectedLessonId(lesson.id);
    window.dispatchEvent(new CustomEvent('lesson:selected', { detail: { lessonId: lesson.id } }));
  };

  // Build the main preview content once to avoid complex nested ternaries and TypeScript narrowing
  const mainContent = (() => {
    // If lesson has raw HTML content (iframe/embed), render it directly.
    // Normalize common iframe attributes so it fills the player canvas.
    try {
      const rawContent = (selectedLesson as any)?.content || '';
        if (rawContent && /<iframe[\s\S]*?>[\s\S]*?<\/iframe>|<iframe[\s\S]*?\/>/i.test(rawContent)) {
        const normalize = (html: string) => {
          // Replace width/height attributes and add responsive styles
          let out = html.replace(/width=("|')?\d+\/?(px)?(\1)?/gi, 'width="100%"');
          out = out.replace(/height=("|')?\d+\/?(px)?(\1)?/gi, 'height="100%"');
          // rewrite external embed src to our proxied HTML endpoint so it can be framed
          out = out.replace(/src=("|')?(http:\/\/216\.48\.182\.5:5000\/api\/videos\/embed\/([0-9a-fA-F\-]+))(\1?)/gi, (m, q, url, id) => {
            return `src="/api/video-proxy/html/${id}"`;
          });
          // ensure style includes width/height 100% and no border
          out = out.replace(/<iframe/gi, '<iframe style="width:100%;height:100%;border:0;" ');
          return out;
        };

        const safeHtml = normalize(String(rawContent));
        return (
          <div className="mb-6 rounded-2xl overflow-hidden bg-black w-full" style={{ height: '100%' }}>
            <div className="w-full h-full" style={{ minHeight: '520px' }} dangerouslySetInnerHTML={{ __html: safeHtml }} />
          </div>
        );
      }
    } catch (e) {
      // ignore and continue to other rendering paths
    }
    // Document or Assignment preview should take precedence over raw video file rendering
    // Also treat lessons whose `video_url` points to a PDF as documents so they render in an iframe.
    const isPdfUrl = (() => {
      try {
        const u = String(selectedLesson?.video_url || '');
        return /\.pdf(\?|$)/i.test(u);
      } catch (e) {
        return false;
      }
    })();

    // Use the inferDisplayLabel helper to robustly detect assignment/document
    // style lessons (covers missing/incorrect `type` values). Also consider
    // explicit types and PDFs detected via video_url. This makes rendering
    // for assignments more consistent even when video_url is present but not
    // previewable.
    const inferredLabel = inferDisplayLabel(selectedLesson);
    const isAssignmentOrDocument = (
      (selectedLesson?.type === 'document' || selectedLesson?.type === 'assignment') ||
      inferredLabel === 'Assignment' || inferredLabel === 'Document' ||
      isPdfUrl ||
      // fallback: if no embeddable video but there is a description or any
      // attachment/file hints, treat it as an assignment/document
      (!selectedLesson?.video_url && (selectedLesson?.description || (selectedLesson as any)?.file_url || (selectedLesson as any)?.attachment_url))
    );
    if (isAssignmentOrDocument) {
      return (
        <div className="bg-white rounded-2xl overflow-hidden border w-full">
          {selectedLesson.video_url ? (
            (() => {
              const urlStr = (resolvedVideoSrc[String(selectedLesson.id)] as string) || (selectedLesson.video_url as string);
              // If the urlStr is a relative protected path and we haven't resolved it yet,
              // avoid attempting to construct a URL or load the raw path (which 404s).
              if (urlStr && !/^https?:\/\//i.test(urlStr) && !/^\/?api\//i.test(urlStr) && !(typeof window !== 'undefined' && urlStr.startsWith(window.location.origin))) {
                return (
                  <div className="flex items-center justify-center h-[60vh] text-gray-400">Preparing video…</div>
                );
              }
              try {
                const url = new URL(urlStr);
                const host = url.hostname.replace('www.', '');
                const isPdf = url.pathname.toLowerCase().endsWith('.pdf');
                const isVideoFile = /\.(mp4|webm|ogg)$/i.test(url.pathname);
                const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');

                if (isPdf) {
                  // Render PDF using in-app PDF.js viewer to prevent browser Save/Print UI
                  try {
                    // dynamically require the client viewer to avoid SSR issues
                    // eslint-disable-next-line @typescript-eslint/no-var-requires
                    const PDFJSViewer = require('@/components/ui/pdfjs-viewer').default;
                    // @ts-ignore - dynamic require
                    return (
                      <div className="w-full">
                        {/* @ts-ignore */}
                        <PDFJSViewer url={urlStr} className="h-[75vh] w-full" />
                      </div>
                    );
                  } catch (e) {
                    // fallback to iframe if viewer isn't available
                    return (
                      <div className="relative w-full flex justify-center items-center" style={{ minHeight: '60vh' }}>
                        <iframe
                          src={urlStr}
                          className="w-full rounded-xl shadow-lg"
                          style={{
                            minHeight: '60vh',
                            height: '75vh',
                            maxHeight: '85vh',
                            zIndex: 1,
                          }}
                          allowFullScreen
                        />
                      </div>
                    );
                  }
                }

                if (isYouTube) {
                  const vid = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
                  const embedUrl = vid ? `https://www.youtube.com/embed/${vid}` : urlStr;
                  return (
                    <div className="mb-6 rounded-2xl overflow-hidden bg-black w-full">
                      <div className="w-full" style={{ width: '100%', aspectRatio: '16/9', maxHeight: '80vh' }}>
                        <iframe className="w-full h-full" src={embedUrl} title={selectedLesson.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
                      </div>
                    </div>
                  );
                }

                if (isVideoFile) {
                  return (
                    <div className="w-full h-full min-h-[400px] md:min-h-[500px]">
                      <ExternalVideoPlayer src={urlStr} />
                    </div>
                  );
                }

                return (
                  <div className="p-4 md:p-8 text-center text-gray-700">
                    <p className="mb-4">Preview not available. Open the resource to view it.</p>
                    <a className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg" href={urlStr} target="_blank" rel="noreferrer">Open Resource</a>
                  </div>
                );
              } catch (e) {
                console.warn('Invalid resource URL for lesson', selectedLesson.id, selectedLesson.video_url, e);
                return (
                  <div className="p-4 md:p-8 text-center text-gray-700">
                    <p className="mb-4">Preview not available.</p>
                    <a className="inline-block px-4 py-2 bg-blue-600 text-white rounded-lg" href={String(selectedLesson.video_url || '#')} target="_blank" rel="noreferrer">Open Resource</a>
                  </div>
                );
              }
            })()
          ) : (
            <div className="p-4 md:p-8 text-left text-gray-700">
              <p className="mb-4">{selectedLesson.description || 'No preview available for this item.'}</p>
              <div>
                {(() => {
                  const resource = selectedLesson.video_url || (selectedLesson as any).file_url || (selectedLesson as any).attachment_url;
                  if (resource) {
                    return (
                      <a className="inline-block px-4 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-white rounded-xl" href={String(resource)} target="_blank" rel="noreferrer">Open Assignment</a>
                    );
                  }
                  if (String(selectedLesson.id).startsWith('assignment-')) {
                    const aid = String(selectedLesson.id).replace(/^assignment-/, '');
                    return (
                      <button onClick={() => router.push(`/assignments/${aid}`)} className="px-4 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-white rounded-xl">Open Assignment</button>
                    );
                  }
                  return (
                    <button className="px-4 py-2 bg-gradient-to-r from-green-500 to-cyan-500 text-white rounded-xl">Open Assignment</button>
                  );
                })()}
              </div>
            </div>
          )}
        </div>
      );
    }

  // If not a document/assignment, but there's a video_url, show the player
  if (selectedLesson.video_url) {
      return (
        <div className="bg-black rounded-2xl overflow-hidden w-full max-w-full">
          {(() => {
            const urlStr = (resolvedVideoSrc[String(selectedLesson.id)] as string) || (selectedLesson.video_url as string);
            if (urlStr && !/^https?:\/\//i.test(urlStr) && !/^\/?api\//i.test(urlStr) && !(typeof window !== 'undefined' && urlStr.startsWith(window.location.origin))) {
              return (
                <div className="flex items-center justify-center h-[60vh] text-white">Preparing video…</div>
              );
            }
            try {
              const url = new URL(urlStr);
              // Helper: build embed URL for YouTube links
              const getYouTubeEmbed = (u: URL) => {
                const h = u.hostname.replace('www.', '');
                if (h === 'youtu.be') {
                  const vid = u.pathname.slice(1);
                  return vid ? `https://www.youtube.com/embed/${vid}${u.search || ''}` : null;
                }
                if (h.endsWith('youtube.com')) {
                  if (u.pathname.startsWith('/embed/')) return u.toString();
                  const v = u.searchParams.get('v');
                  if (v) return `https://www.youtube.com/embed/${v}`;
                }
                return null;
              };

              const embedUrl = getYouTubeEmbed(url);
              // If this URL points to the external player embed endpoint, try to resolve a direct stream URL
              const isExternalPlayerEmbed = /\/api\/videos\/embed\//i.test(urlStr) || /api\.aiskool\.com/i.test(urlStr) || urlStr.includes('216.48.182.5');
              if (embedUrl) {
                return (
                  <div className="mb-6 rounded-2xl overflow-hidden bg-black w-full">
                    <div className="w-full" style={{ width: '100%', aspectRatio: '16/9', maxHeight: '80vh' }}>
                      <iframe
                        className="w-full h-full"
                        src={embedUrl}
                        title={selectedLesson.title}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        allowFullScreen
                      />
                    </div>
                  </div>
                );
              }
              // If it's an external player embed page, attempt to fetch a direct stream URL
              if (isExternalPlayerEmbed) {
                // Extract the embed id from the path (last segment)
                let id = urlStr.split('/').filter(Boolean).pop() || '';
                const cached = externalDirectSrc[String(selectedLesson.id)];
                if (!cached) {
                  // resolve via our proxy API
                  (async () => {
                    try {
                      const apiRes = await fetch(`/api/video-proxy/embed/${encodeURIComponent(id)}`);
                      if (!apiRes.ok) return setExternalDirectSrc(prev => ({ ...prev, [String(selectedLesson.id)]: null }));
                      const body = await apiRes.json();
                      setExternalDirectSrc(prev => ({ ...prev, [String(selectedLesson.id)]: body.directUrl || null }));
                    } catch (e) {
                      setExternalDirectSrc(prev => ({ ...prev, [String(selectedLesson.id)]: null }));
                    }
                  })();
                  // while resolving, show a preparing message
                  return (
                    <div className="flex items-center justify-center h-[60vh] text-white">Preparing video…</div>
                  );
                }

                // If proxy returned a direct URL, use native <video> to allow full-bleed sizing
                if (cached) {
                  return (
                    <div className="mb-6 rounded-2xl overflow-hidden bg-black w-full">
                      <div className="w-full" style={{ width: '100%', aspectRatio: '16/9', maxHeight: '80vh' }}>
                        <ExternalVideoPlayer src={cached} />
                      </div>
                    </div>
                  );
                }

                // Fallback to iframe when no direct URL available. Use our proxied HTML endpoint
                // so the embed can be framed even if the original server sets X-Frame-Options.
                const embedId = urlStr.split('/').filter(Boolean).pop() || '';
                const proxiedSrc = `/api/video-proxy/html/${encodeURIComponent(embedId)}`;
                return (
                  <div className="mb-6 rounded-2xl overflow-hidden bg-black w-full">
                    <div className="w-full" style={{ width: '100%', aspectRatio: '16/9', maxHeight: '80vh' }}>
                      <iframe
                        className="w-full h-full"
                        src={proxiedSrc}
                        title={selectedLesson.title}
                        allow="autoplay; encrypted-media; fullscreen"
                        allowFullScreen
                      />
                    </div>
                  </div>
                );
              }

              // Not a YouTube link or external embed — treat as a normal video file or signed URL
              return (
                <div className="w-full h-full">
                  <ExternalVideoPlayer src={urlStr} />
                </div>
              );
            } catch (e) {
              console.warn('Invalid video URL for lesson', selectedLesson.id, selectedLesson.video_url, e);
              return (
                <div className="w-full h-full">
                  <ExternalVideoPlayer src={String(selectedLesson.video_url)} />
                </div>
              );
            }
          })()}
        </div>
      );
    }

    // Quiz preview
    if (selectedLesson.type === 'quiz') {
      return (
        <div className="bg-white rounded-2xl p-4 md:p-8 border w-full">
          <h3 className="text-lg font-semibold mb-4">Quiz Preview</h3>
          <p className="text-gray-600 mb-4">This is a quiz item. When you press Start, you will be taken to the quiz interface.</p>
          <button onClick={() => {
            const params = new URLSearchParams();
            params.set('courseId', courseId || '');
            params.set('role', role || 'student');
            const section = curriculum.find(s => s.lessons.some(l => l.id === selectedLesson.id));
            if (section) params.set('sectionId', section.id);
            // include the originating lesson id so the quiz can navigate back
            params.set('lessonId', selectedLesson.id);
            // include the next lesson id (if any) so the quiz result can navigate forward
            const next = allLessons[allLessons.findIndex(l => l.id === selectedLesson.id) + 1];
            if (next && next.id) params.set('nextLessonId', String(next.id));
            router.push(`/quizzes/${selectedLesson.id}?${params.toString()}`);
          }} className="px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-xl">Start Quiz</button>
        </div>
      );
    }

    // Default fallback
    return (
      <div className="bg-white rounded-2xl p-4 md:p-8 border w-full">
        <p className="text-gray-700">{selectedLesson.description || 'No preview available for this lesson type.'}</p>
      </div>
    );
  })();

  if (!selectedLesson) return null;

  return (
    <>
      {/* Floating Dashboard button (small) - visible when nav/footer are absent */}
      <button
        onClick={() => router.push('/student/dashboard')}
        title="Open dashboard"
        aria-label="Open dashboard"
        className="fixed left-4 bottom-6 z-50 bg-indigo-600 text-white p-3 rounded-full shadow-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-300"
      >
        <LayoutDashboard className="w-5 h-5" />
      </button>
      <div className="space-y-3 md:space-y-4 h-full flex flex-col">
        {/* Header - Responsive padding and text */}
        <div className="bg-white rounded-xl md:rounded-2xl shadow-lg md:shadow-xl border border-gray-100 p-3 md:p-4">
          <div className="flex items-center justify-between">
            <div className="flex-1 min-w-0">
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mb-1">
                {inferDisplayLabel(selectedLesson)}
              </span>
              <h2 className="text-lg md:text-xl font-bold text-gray-900 truncate">{selectedLesson.title}</h2>
              {selectedLesson.description && (() => {
                try {
                  const desc = String(selectedLesson.description || '');
                  const isEmbed = /\/api\/videos\/embed\//i.test(desc) || /api\.aiskool\.com/i.test(desc) || desc.includes('216.48.182.5');
                  const isSameAsVideo = String(selectedLesson.video_url || '').trim() === desc.trim();
                  if (isEmbed || isSameAsVideo) return null;
                  return (
                    <p className="text-gray-600 text-xs md:text-sm mt-1 line-clamp-2">{selectedLesson.description}</p>
                  );
                } catch (e) {
                  return (
                    <p className="text-gray-600 text-xs md:text-sm mt-1 line-clamp-2">{selectedLesson.description}</p>
                  );
                }
              })()}
            </div>

            {/* Fullscreen toggle - opens the existing fullscreen overlay */}
            <div className="ml-4 flex-shrink-0">
              <button
                onClick={() => setIsFullscreen(true)}
                aria-label="Open fullscreen"
                title="Open fullscreen"
                className="px-4 py-2 text-sm md:text-base rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              >
                Full screen
              </button>
            </div>
          </div>
        </div>

        {/* Main Player Area - Responsive height */}
        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-white rounded-xl md:rounded-2xl border border-gray-200 shadow-sm p-3 md:p-4 flex-1 flex flex-col min-h-0">
            <div className="flex-1 flex flex-col min-h-0">
              {/* fullscreen button removed as requested */}

              {/* Main Content - Responsive sizing */}
              <div className="flex-1 min-h-0 flex items-center justify-center">
                <div className="w-full h-full max-w-full">
                  {mainContent}
                </div>
              </div>
            </div>

            {/* Navigation - Responsive layout */}
            <div className="flex items-center justify-between mt-3 md:mt-4 pt-3 md:pt-4 border-t border-gray-200">
              <button
                onClick={() => onNavigate(previousLesson)}
                className={previousLesson ? 'px-4 py-2 md:px-5 md:py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm text-sm md:text-base' : 'px-4 py-2 md:px-5 md:py-2 rounded-md bg-gray-100 text-gray-400 cursor-not-allowed text-sm md:text-base'}
                disabled={!previousLesson}
              >
                <span className="text-sm md:text-base font-medium">Previous</span>
              </button>

              {/* Show check/tick if lesson is completed */}
              {selectedLesson?.completed && (
                <span className="ml-2 text-green-500 flex items-center">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="ml-1 text-xs">Done</span>
                </span>
              )}

                {nextLesson ? (
                  <button
                    onClick={async () => {
                      // Mark current lesson as completed before navigating (same as Next behavior)
                      if (selectedLesson && !selectedLesson.completed) {
                        setCurriculum(prev => prev.map(s => ({
                          ...s,
                          lessons: s.lessons.map(l => l.id === selectedLesson.id ? { ...l, completed: true } : l)
                        })));
                        try {
                          const ev = new CustomEvent('lesson:completion-changed', { detail: { lessonId: selectedLesson.id, completed: true } });
                          window.dispatchEvent(ev);
                        } catch (e) {}
                        try { await persistLessonCompletion(selectedLesson.id); } catch (e) {}
                        try { window.dispatchEvent(new CustomEvent('lesson:request-toggle', { detail: { lessonId: selectedLesson.id, completed: true, source: 'main' } })); } catch (e) {}
                      }
                      onNavigate(nextLesson);
                    }}
                    className={'px-4 py-2 md:px-5 md:py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm text-sm md:text-base'}
                  >
                    <span className="text-sm font-medium">Next</span>
                  </button>
                ) : (
                  // End Course button shown on the last lesson when there is no "next"
                  <button
                    onClick={async () => {
                      // Mark current lesson completed and persist, then navigate to student's levels (end of course flow)
                      if (selectedLesson && !selectedLesson.completed) {
                        setCurriculum(prev => prev.map(s => ({
                          ...s,
                          lessons: s.lessons.map(l => l.id === selectedLesson.id ? { ...l, completed: true } : l)
                        })));
                        try {
                          const ev = new CustomEvent('lesson:completion-changed', { detail: { lessonId: selectedLesson.id, completed: true } });
                          window.dispatchEvent(ev);
                        } catch (e) {}
                        try { await persistLessonCompletion(selectedLesson.id); } catch (e) {}
                        try { window.dispatchEvent(new CustomEvent('lesson:request-toggle', { detail: { lessonId: selectedLesson.id, completed: true, source: 'main' } })); } catch (e) {}
                      }
                      // Redirect student to their levels/dashboard - adjust if you prefer a different destination
                      try { router.push('/student/levels'); } catch (e) { console.warn('navigate failed', e); }
                    }}
                    className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                  >
                    <span>End Course</span>
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>

      {/* Fullscreen overlay */}
      {isFullscreen && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-2 md:p-4"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setIsFullscreen(false); }}
          onContextMenu={(e) => { e.preventDefault(); }}
        >
          <div className="relative w-full h-full max-w-full max-h-full md:max-w-[1400px] md:max-h-[90vh] bg-black rounded-lg overflow-hidden">
            <button
              onClick={() => setIsFullscreen(false)}
              className="absolute right-2 top-2 md:right-3 md:top-3 z-20 bg-white/90 rounded-full p-1 md:p-2 shadow"
              title="Close fullscreen"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 md:h-5 md:w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </button>

            {/* Fullscreen player content */}
            <div className="w-full h-full">
              {(() => {
                const urlStr = String(selectedLesson?.video_url || '');
                try {
                  if (!urlStr) {
                    return (
                      <div className="w-full h-full overflow-auto p-4 md:p-8 text-white">
                        <h3 className="text-xl md:text-2xl font-semibold mb-4">{selectedLesson?.title}</h3>
                        <div className="prose prose-invert max-w-none text-sm md:text-base">{selectedLesson?.description}</div>
                      </div>
                    );
                  }

                  const url = new URL(urlStr);
                  const host = url.hostname.replace('www.', '');
                  const isPdf = url.pathname.toLowerCase().endsWith('.pdf');
                  const isVideoFile = /\.(mp4|webm|ogg)$/i.test(url.pathname);
                  const isYouTube = host.includes('youtube.com') || host.includes('youtu.be');

                  if (isPdf) {
                    // Fullscreen: prefer the in-app PDF viewer to avoid native Save/Print UI
                    try {
                      // eslint-disable-next-line @typescript-eslint/no-var-requires
                      const PDFJSViewer = require('@/components/ui/pdfjs-viewer').default;
                      // @ts-ignore
                      return (
                        <div className="relative w-full h-full overflow-hidden">
                          {/* @ts-ignore */}
                          <PDFJSViewer url={urlStr} className="h-full w-full" />
                        </div>
                      );
                    } catch (e) {
                      const thumbWidth = 240;
                      return (
                        <div className="relative w-full h-full overflow-hidden">
                          {/* mask the PDF viewer toolbar icons (download/print) in fullscreen */}
                          <div className="absolute top-0 right-12 z-30 h-12 w-40 bg-black" aria-hidden onContextMenu={(e) => { e.preventDefault(); }} />
                          <iframe
                            src={urlStr}
                            className="block h-full"
                            style={{ width: `calc(100% + ${thumbWidth}px)`, transform: `translateX(-${thumbWidth}px)` }}
                          />
                        </div>
                      );
                    }
                  }

                  if (isYouTube) {
                    const vid = host === 'youtu.be' ? url.pathname.slice(1) : url.searchParams.get('v');
                    const embedUrl = vid ? `https://www.youtube.com/embed/${vid}${url.search || ''}` : urlStr;
                    return <iframe className="w-full h-full" src={embedUrl} title={selectedLesson?.title} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />;
                  }

                  if (isVideoFile) {
                    return (
                      <div className="w-full h-full">
                        <ExternalVideoPlayer src={urlStr} />
                      </div>
                    );
                  }

                  // Fallback: render in iframe or link out
                  return (
                    <iframe className="w-full h-full" src={urlStr} title={selectedLesson?.title} />
                  );
                } catch (e) {
                  return (
                    <div className="w-full h-full overflow-auto p-4 md:p-8 text-white">
                      <h3 className="text-xl md:text-2xl font-semibold mb-4">{selectedLesson?.title}</h3>
                      <div className="prose prose-invert max-w-none text-sm md:text-base">{selectedLesson?.description || 'Preview not available.'}</div>
                    </div>
                  );
                }
              })()}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
