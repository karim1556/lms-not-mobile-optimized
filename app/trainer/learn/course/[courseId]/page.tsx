"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth, useOrganization, useUser } from "@clerk/nextjs";
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
  url?: string;
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

export default function TrainerCoursePlaybackPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const id = String(courseId);
  const router = useRouter();

  const { isLoaded: authLoaded, isSignedIn } = useAuth();
  const { organization, isLoaded: orgLoaded } = useOrganization();
  const { user, isLoaded: userLoaded } = useUser();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [course, setCourse] = useState<ApiCourse | null>(null);
  const [courseLevels, setCourseLevels] = useState<any[]>([]);
  const [trainerIdDb, setTrainerIdDb] = useState<string | null>(null);

  // Load course and levels
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

  // Authorization for trainer: trainer's assigned levels must include any course level
  useEffect(() => {
    let active = true;
    (async () => {
      if (!authLoaded || !userLoaded || !orgLoaded) return;
      if (!isSignedIn || !organization?.id) { if (active){ setAuthorized(false); setLoading(false);} return; }
      try {
        setLoading(true);
        setError(null);
        const courseLevelIds = new Set((courseLevels || []).map((l:any) => Number(l.id)));

        // resolve school and current trainer record
        try { await fetch('/api/sync/me', { method: 'POST', cache: 'no-store' }) } catch {}
        const schoolRes = await fetch('/api/me/school', { cache: 'no-store' });
        const school = schoolRes.ok ? await schoolRes.json() : null;
        const sid = school?.schoolId;
        let allowed = false; let resolvedTrainerId: string | null = null;
        if (sid) {
          const trRes = await fetch(`/api/trainers?schoolId=${encodeURIComponent(sid)}`, { cache: 'no-store' });
          const tr = await trRes.json();
          if (trRes.ok && Array.isArray(tr)) {
            const myEmail = user?.primaryEmailAddress?.emailAddress?.toLowerCase();
            const mine = tr.find((t:any) => (t.email || '').toLowerCase() === (myEmail || ''));
            if (mine?.id) {
              const lvRes = await fetch(`/api/trainers/${mine.id}/levels`, { cache: 'no-store' });
              const lv = await lvRes.json();
              if (lvRes.ok && Array.isArray(lv)) {
                allowed = lv.some((l:any) => courseLevelIds.has(Number(l.id)));
                if (allowed) resolvedTrainerId = String(mine.id);
              }
            }
          }
        }
        if (!active) return;
        setAuthorized(Boolean(allowed));
        setTrainerIdDb(resolvedTrainerId);
      } catch (e:any) {
        if (!active) return;
        setError(e?.message || 'Authorization failed');
        setAuthorized(false);
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false };
  }, [authLoaded, userLoaded, orgLoaded, isSignedIn, organization?.id, user?.primaryEmailAddress?.emailAddress, JSON.stringify(courseLevels)]);

  // Enrich assignment lessons and sign resource URLs (same behavior as student playback)
  useEffect(() => {
    let active = true;
    (async () => {
      if (!course) return;

      try {
        const updatedCourse = JSON.parse(JSON.stringify(course));
        let changed = false;

        // Enrich assignment metadata by fetching assignment details when missing
        for (const section of updatedCourse.curriculum || []) {
          for (const lesson of section.lessons || []) {
            try {
              const isAssignment = String((lesson as any).type || '').toLowerCase().includes('assign');
              const lacksDetails = !(lesson as any).description && !(lesson as any).video_url && !(lesson as any).file_url && !(lesson as any).attachment_url;
              if (isAssignment && lacksDetails) {
                const aid = String(lesson.id);
                try {
                  const aRes = await fetch(`/api/assignments/${encodeURIComponent(aid)}`, { cache: 'no-store' });
                  if (!aRes.ok) continue;
                  const a = await aRes.json();
                  if (!a) continue;
                  if (a.description) lesson.description = a.description;
                  if (a.instructions) lesson.description = lesson.description || a.instructions;
                  if (a.attachment_url) lesson.attachment_url = a.attachment_url;
                  if (a.file_url) lesson.file_url = a.file_url;
                  if (a.url) lesson.video_url = lesson.video_url || a.url;
                  changed = true;
                } catch (e) {
                  console.warn('trainer-page: failed to fetch assignment', aid, e);
                }
              }
            } catch (e) {}
          }
        }

        // Request signed URLs for resources stored in course-files
        for (const section of updatedCourse.curriculum || []) {
          for (const lesson of section.lessons || []) {
            const urlCandidate = String(lesson.video_url || (lesson as any).file_url || (lesson as any).attachment_url || lesson.url || '').trim();
            if (!urlCandidate) continue;

            let path = '';
            if (/course-files\//.test(urlCandidate)) {
              try {
                if (urlCandidate.startsWith('http')) {
                  const u = new URL(urlCandidate);
                  const parts = u.pathname.split('/course-files/');
                  if (parts.length > 1) path = parts[1];
                } else {
                  path = urlCandidate.replace(/^\/+/, '');
                }
              } catch (e) {
                // ignore
              }
            }

            if (!path) continue;

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
                console.warn('trainer-page: signed-url failed for', path, body);
              }
            } catch (e) {
              console.warn('trainer-page: exception requesting signed url for', path, e);
            }
          }
        }

        if (active && changed) setCourse(updatedCourse);
      } catch (e) {
        // noop
      }
    })();
    return () => { active = false };
  }, [course]);

  // Normalize to playback component (match student mapping)
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
          const hasInstructions = Boolean((l as any).instructions || (l as any).instructions_html || (l as any).task || (l as any).assignment);
          const hasAttachment = Boolean((l as any).attachment_url || (l as any).file_url || (l as any).signed_url || nested);
          if (hasInstructions && /assign/i.test(String((l as any).title || ''))) {
            inferred = 'assignment';
          } else if (hasInstructions && hasAttachment) {
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
            <div className="text-sm text-destructive mb-3">You don't have access to this course. It must be assigned to you via a level.</div>
            <Button variant="outline" onClick={() => router.push('/trainer/levels')}>Back to My Levels</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!playbackCourse) return <div className="p-6">Course not found.</div>;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
  <div className="mx-auto px-6 py-8 max-w-[1400px] w-full">
        <CourseHeaderClient title={playbackCourse.title} initialCurriculum={playbackCourse.curriculum} />

        <div className="grid lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1">
            <CourseSidebarClient initialCurriculum={playbackCourse.curriculum} courseId={playbackCourse.id} role="trainer" trainerId={trainerIdDb ?? undefined} />
          </div>

          <div className="lg:col-span-3">
            <CourseMainClient initialCurriculum={playbackCourse.curriculum} courseId={playbackCourse.id} role="trainer" />
          </div>
        </div>
      </div>
    </div>
  );
}
