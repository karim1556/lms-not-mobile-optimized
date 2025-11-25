"use client";

import { useEffect, useMemo, useState } from "react";
import { Menu, ChevronLeft, ChevronRight } from 'lucide-react';
import { useParams, useRouter } from "next/navigation";
import { useAuth, useUser } from "@clerk/nextjs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import CourseHeaderClient from '@/components/courses/course-header-client';
import CourseSidebarClient from '@/components/courses/course-sidebar-client';
import CourseMainClient from '@/components/courses/course-main-client';

interface ApiLesson {
  id: string | number;
  title: string;
  type?: string;
  duration?: number | string;
  content?: string;
  video_url?: string;
  url?: string; // sometimes used
}

interface ApiSection {
  id: string | number;
  title: string;
  lessons: ApiLesson[];
}

interface ApiCourse {
  id: string | number;
  title: string;
  overview?: string;
  description?: string;
  curriculum: ApiSection[];
}

export default function StudentCoursePlaybackPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const id = String(courseId);
  const router = useRouter();

  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [course, setCourse] = useState<ApiCourse | null>(null);
  const [courseLevels, setCourseLevels] = useState<any[]>([]);
  const [activeBatchId, setActiveBatchId] = useState<string | null>(null);
  const [activeStudentId, setActiveStudentId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Disable right-click/context menu on playback page for students
  useEffect(() => {
    const onContext = (e: MouseEvent) => e.preventDefault();
    window.addEventListener('contextmenu', onContext as any);
    return () => window.removeEventListener('contextmenu', onContext as any);
  }, []);

  // Hide global header/footer while on the student playback page to reduce distractions
  useEffect(() => {
    try {
      document.body.classList.add('playback-hide-shell');
    } catch (e) {}
    return () => {
      try { document.body.classList.remove('playback-hide-shell'); } catch (e) {}
    };
  }, []);

  // Load course meta and its levels
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [cRes, lvRes] = await Promise.all([
          fetch(`/api/courses/${id}/details`, { cache: 'no-store' }),
          fetch(`/api/courses/${id}/levels`, { cache: 'no-store' })
        ]);
        const c = await cRes.json();
        const lv = await lvRes.json();
        if (!active) return;
        setCourse(cRes.ok ? c : null);
        setCourseLevels(Array.isArray(lv) ? lv : []);
      } catch (e:any) {
        if (active) setError('Failed to load course');
      }
    })();
    return () => { active = false };
  }, [id]);

  // Guard: only students assigned the course via a level can pass
  useEffect(() => {
    let active = true;
    (async () => {
      if (!authLoaded || !userLoaded) return;
      if (!isSignedIn) { if (active){ setAuthorized(false); setLoading(false);} return; }
      try {
        setLoading(true);
        setError(null);
        const courseLevelIds = new Set((courseLevels || []).map((l:any) => Number(l.id)));

        // get batches for this student
        const enrRes = await fetch(`/api/batch-enrolments?studentClerkId=${encodeURIComponent(user?.id || '')}`, { cache: 'no-store' });
        const enrolments = await enrRes.json();
        if (!enrRes.ok) throw new Error(enrolments?.error || 'Failed to load enrolments');
        const enrols = Array.isArray(enrolments) ? enrolments : [];
        const batchIds: string[] = [...new Set(enrols.map((e:any) => e.batch_id).filter(Boolean))];
        const batchToStudent = new Map<string, string>();
        for (const e of enrols) {
          if (e.batch_id && e.student_id) batchToStudent.set(String(e.batch_id), String(e.student_id));
        }

        let allowed = false; let chosenBatch: string | null = null;
        for (const bid of batchIds) {
          try {
            const blRes = await fetch(`/api/batches/${bid}/levels`, { cache: 'no-store' });
            const bl = await blRes.json();
            if (blRes.ok && Array.isArray(bl)) {
              if (bl.some((l:any) => courseLevelIds.has(Number(l.id)))) { allowed = true; chosenBatch = String(bid); break; }
            }
          } catch {}
        }
        if (!active) return;
        setAuthorized(allowed);
        if (allowed && chosenBatch) {
          setActiveBatchId(chosenBatch);
          const sid = batchToStudent.get(String(chosenBatch)) || null;
          setActiveStudentId(sid);
        } else {
          setActiveBatchId(null);
          setActiveStudentId(null);
        }
      } catch (e:any) {
        if (!active) return;
        setError(e?.message || 'Authorization failed');
        setAuthorized(false);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false };
  }, [authLoaded, userLoaded, isSignedIn, user?.id, JSON.stringify(courseLevels)]);

  // If files/resources are stored in Supabase `course-files` bucket, request signed URLs
  useEffect(() => {
    let active = true;
    (async () => {
      if (!course) return;
      try {
        // Deep copy to mutate safely
        const updatedCourse = JSON.parse(JSON.stringify(course));
        let changed = false;

        // First: enrich assignment items by fetching assignment details when needed
        for (const section of updatedCourse.curriculum || []) {
          for (const lesson of section.lessons || []) {
            try {
              const isAssignment = String((lesson as any).type || '').toLowerCase().includes('assign');
              const lacksDetails = !(lesson as any).description && !(lesson as any).video_url && !(lesson as any).file_url && !(lesson as any).attachment_url;
              if (isAssignment && lacksDetails) {
                // fetch assignment details from server endpoint
                const aid = String(lesson.id);
                  try {
                  const aRes = await fetch(`/api/assignments/${encodeURIComponent(aid)}`, { cache: 'no-store' });
                  if (!aRes.ok) continue;
                  const a = await aRes.json();
                  if (!a) continue;
                  // Map common fields
                  if (a.description) lesson.description = a.description;
                  if (a.instructions) lesson.description = lesson.description || a.instructions;
                  if (a.attachment_url) lesson.attachment_url = a.attachment_url;
                  if (a.file_url) lesson.file_url = a.file_url;
                  if (a.url) lesson.video_url = lesson.video_url || a.url;
                  changed = true;
                } catch (e) {
                  console.warn('student-page: failed to fetch assignment', aid, e);
                }
              }
            } catch (e) {}
          }
        }

        // Second: request signed URLs or tokens for any lesson resource that references our storage path
        for (const section of updatedCourse.curriculum || []) {
          for (const lesson of section.lessons || []) {
            const urlCandidate = String(lesson.video_url || (lesson as any).file_url || (lesson as any).attachment_url || lesson.url || '').trim();
            if (!urlCandidate) continue;

            // 1) If the URL references our Supabase `course-files` bucket, request its signed URL
            let path = '';
            if (/course-files\//.test(urlCandidate)) {
              try {
                if (urlCandidate.startsWith('http')) {
                  const u = new URL(urlCandidate);
                  const parts = u.pathname.split('/course-files/');
                  if (parts.length > 1) path = parts[1];
                } else {
                  // raw path
                  path = urlCandidate.replace(/^\/+/, '');
                }
              } catch (e) {
                // ignore
              }

              if (path) {
                  try {
                  const res = await fetch('/api/course-files/signed-url', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ path })
                  });
                  if (!active) return;
                  const body = await res.json();
                  if (res.ok && body?.signedUrl) {
                    lesson.video_url = body.signedUrl;
                    changed = true;
                  } else {
                    console.warn('Signed URL endpoint failed for', path, body);
                  }
                } catch (e) {
                  console.warn('Exception requesting signed URL for', path, e);
                }
              }
              continue;
            }

            // 2) If the urlCandidate looks like a relative protected-videos path (e.g. "<courseId>/<filename>")
            // request a short-lived token and set the lesson.video_url to our streaming endpoint.
            // Heuristic: contains a slash and does not start with http(s):
            // Only treat raw relative storage paths (courseId/filename). Skip if it's an absolute URL,
            // already a stream URL (`/api/...`) or other API path to avoid double-wrapping.
            if (!/^https?:\/\//i.test(urlCandidate) && /\/.+/.test(urlCandidate) && !/^\/?api\//i.test(urlCandidate)) {
              const protectedPath = urlCandidate.replace(/^\/+/, '');
                try {
                const tRes = await fetch('/api/media/get-signed-token', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ path: protectedPath })
                });
                if (!active) return;
                const tb = await tRes.json();
                if (tRes.ok && tb?.token) {
                  // Use an absolute URL so downstream code that calls `new URL()` won't throw.
                  const origin = typeof window !== 'undefined' ? window.location.origin : '';
                  lesson.video_url = `${origin}/api/media/stream?token=${encodeURIComponent(tb.token)}`;
                  changed = true;
                } else {
                  console.warn('Media token endpoint failed for', protectedPath, tb);
                }
              } catch (e) {
                console.warn('Exception requesting media token for', protectedPath, e);
              }
            }
          }
        }

        if (active && changed) {
          setCourse(updatedCourse);
        }
      } catch (e) {
        // noop
      }
    })();
    return () => { active = false };
  }, [course]);

  // Transform API shape to CoursePlaybackClientV2 props
  const playbackCourse = useMemo(() => {
    if (!course) return null;
    const sections = (course.curriculum || []).map((s) => ({
      id: String(s.id),
      title: s.title,
      lessons: (s.lessons || []).map((l) => {
        // Try multiple URL fields commonly used by our APIs
        // Try nested collections too
        const nested = (() => {
          const a: any = l as any;
          const arrays = [a.attachments, a.resources, a.materials, a.files, a.assets, a.media];
          for (const arr of arrays) {
            if (Array.isArray(arr) && arr.length > 0) {
              const first = arr[0] || {};
              const u = first.signed_url || first.url || first.file_url || first.video_url || first.path;
              if (u) return u;
            }
          }
          // Objects commonly used
          const objs = [a.video, a.asset, a.document];
          for (const obj of objs) {
            if (obj) {
              const u = obj.signed_url || obj.url || obj.file_url || obj.video_url || obj.path;
              if (u) return u;
            }
          }
          return '';
        })();

        const rawUrl =
          (l as any).file_url ||
          (l as any).signed_url ||
          (l as any).fileUrl ||
          (l as any).videoUrl ||
          l.video_url ||
          (l as any).content_url ||
          l.url ||
          nested ||
          '';

        // Infer type when missing using explicit fields and URL/content hints
        const lower = typeof rawUrl === 'string' ? rawUrl.toLowerCase() : '';
        const rawType = (l as any).type ? String((l as any).type).toLowerCase() : '';
        let inferred: any = 'lesson';

        // If API provided a type string, normalize it to our expected types
        if (rawType) {
          if (rawType.includes('assign')) inferred = 'assignment';
          else if (rawType.includes('doc') || rawType.includes('pdf')) inferred = 'document';
          else if (rawType === 'video' || rawType === 'video_file') inferred = 'video_file';
          else if (rawType === 'quiz') inferred = 'quiz';
          else inferred = rawType;
        } else {
          // Heuristics when type is not provided
          // Assignment-like items often have instructions, attachment_url, or 'assignment' in the title
          const hasInstructions = Boolean((l as any).instructions || (l as any).instructions_html || (l as any).task || (l as any).assignment);
          const hasAttachment = Boolean((l as any).attachment_url || (l as any).file_url || (l as any).signed_url || nested);
          if (hasInstructions && /assign/i.test(String((l as any).title || ''))) {
            inferred = 'assignment';
          } else if (hasInstructions && hasAttachment) {
            // frequently assignments include both instructions and attachments
            inferred = 'assignment';
          } else if (lower.endsWith('.mp4') || lower.includes('video') || lower.match(/\.(mp4|webm|ogg)$/i)) {
            inferred = 'video_file';
          } else if (lower.endsWith('.pdf')) {
            inferred = 'document';
          }
        }

        // Prefer explicit content, fall back to common fields
        const contentHtml =
          (l as any).content ||
          (l as any).instructions ||
          (l as any).description ||
          (l as any).html ||
          (l as any).body ||
          '';

        // If the lesson content includes a URL (common when editors paste a YouTube link
        // into the content field), prefer that as the video_url so the client can embed it.
        let contentUrl = '';
        try {
          const urlMatch = String(contentHtml).match(/https?:\/\/[^\s)"']+/i);
          if (urlMatch) contentUrl = urlMatch[0];
        } catch (e) { contentUrl = ''; }

        return {
          id: String(l.id),
          title: l.title,
          type: inferred as any,
          duration: typeof l.duration === 'number' ? l.duration : undefined,
          // map content -> description so client components (which read `description`) show previews
          content: contentHtml,
          description: contentHtml,
          // prefer explicit file/url fields, but fall back to any URL detected in content
          video_url: rawUrl || contentUrl || undefined,
        };
      })
    }));
    return {
      id: String(course.id),
      title: course.title,
      overview: course.overview || course.description,
      curriculum: sections,
    };
  }, [course]);

  if (loading) return <div className="p-6">Loading...</div>;

  if (!authorized) {
    return (
      <div className="p-6 space-y-3">
        <Card>
          <CardContent className="p-6">
            <div className="text-sm text-destructive mb-3">You don't have access to this course. It must be assigned to your batch.</div>
            <Button variant="outline" onClick={() => router.push('/student/levels')}>Back to My Levels</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!playbackCourse) return <div className="p-6">Course not found.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
  <div className="mx-auto px-6 py-8 max-w-[1400px] w-full">
        {/* Client-updating Course Header */}
        <CourseHeaderClient title={playbackCourse.title} initialCurriculum={playbackCourse.curriculum} />

        <div className="flex flex-col lg:flex-row gap-6 mt-6">
          {/* Sidebar - Fixed width and proper styling */}
          {!sidebarCollapsed && (
            <div className="w-full lg:w-80 flex-shrink-0">
              <div className="relative">
                <div className="sticky top-6 h-[calc(100vh-120px)] overflow-hidden">
                  <CourseSidebarClient 
                    initialCurriculum={playbackCourse.curriculum} 
                    courseId={playbackCourse.id} 
                    role="student" 
                    studentId={activeStudentId ?? undefined} 
                    batchId={activeBatchId ?? undefined} 
                  />
                </div>

                {/* Collapse button placed near the sidebar (right edge) */}
                <button
                  onClick={() => setSidebarCollapsed(true)}
                  aria-label="Collapse sidebar"
                  className="hidden lg:inline-flex absolute -right-3 top-10 z-40 items-center justify-center p-1.5 bg-white border border-gray-200 rounded-full shadow-sm hover:shadow-md"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Main Content - Increased player size */}
          <div className="flex-1 min-w-0">
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <CourseMainClient 
                initialCurriculum={playbackCourse.curriculum} 
                courseId={playbackCourse.id} 
                role="student" 
                studentId={activeStudentId ?? undefined}
                batchId={activeBatchId ?? undefined}
              />
            </div>
          </div>
        </div>
        {/* Floating reopen button when sidebar collapsed */}
        {sidebarCollapsed && (
          <button
            onClick={() => setSidebarCollapsed(false)}
            aria-label="Open sidebar"
            className="fixed left-4 top-28 z-50 inline-flex items-center justify-center p-2 bg-white border border-gray-200 rounded-full shadow-md hover:shadow-lg"
          >
            <Menu className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}