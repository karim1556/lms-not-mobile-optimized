"use client";

import { useEffect, useState } from "react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { CheckCircle, PlayCircle, FileText, HelpCircle, ClipboardEdit } from "lucide-react";
import CompletionToggle from "./completion-toggle";

type LessonType = 'lesson' | 'quiz' | 'assignment' | 'video' | 'document' | 'video_file';

interface Lesson { id: string; title: string; type?: LessonType; duration?: number; completed?: boolean }
interface Section { id: string; title: string; lessons: Lesson[] }

function getIcon(lesson: Lesson) {
  const base = 'w-5 h-5';
  const color = lesson.completed
    ? 'text-green-600'
    : (lesson.type === 'video' || lesson.type === 'video_file')
      ? 'text-blue-500'
      : lesson.type === 'quiz'
        ? 'text-green-500'
        : lesson.type === 'assignment'
          ? 'text-purple-500'
          : 'text-gray-500';

  switch (lesson.type) {
    case 'video': case 'video_file': return <PlayCircle className={`${base} ${color}`} />;
    case 'quiz': return <HelpCircle className={`${base} ${color}`} />;
    case 'assignment': return <ClipboardEdit className={`${base} ${color}`} />;
    default: return <FileText className={`${base} ${color}`} />;
  }
}

export default function CourseSidebarClient({ initialCurriculum, courseId, role = 'student', studentId, trainerId, batchId }: { initialCurriculum: Section[]; courseId: string; role?: 'student'|'trainer'; studentId?: string; trainerId?: string; batchId?: string }) {
  const [curriculum, setCurriculum] = useState<Section[]>(initialCurriculum || []);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  useEffect(() => {
    const onChange = (ev: any) => {
      const { lessonId, sectionId, completed } = ev.detail || {};
      if (!lessonId) return;
      setCurriculum((prev) => prev.map(s => ({
        ...s,
        lessons: s.lessons.map(l => l.id === lessonId ? { ...l, completed } : l)
      })));
    };
    window.addEventListener('lesson:completion-changed', onChange);
    window.addEventListener('lesson:completion-confirmed', onChange);
    const onSelect = (ev: any) => {
      const { lessonId } = ev.detail || {};
      if (!lessonId) return;
      setSelectedLessonId(lessonId);
    };
    window.addEventListener('lesson:selected', onSelect as EventListener);
    return () => {
      window.removeEventListener('lesson:completion-changed', onChange);
      window.removeEventListener('lesson:completion-confirmed', onChange);
      window.removeEventListener('lesson:selected', onSelect as EventListener);
    };
  }, []);

  // Broadcast owner identifiers if provided via props so other components can use them
  useEffect(() => {
    try {
      if (role === 'student') {
        if (studentId && batchId) {
          setTimeout(() => {
            try { window.dispatchEvent(new CustomEvent('owner:resolved', { detail: { role: 'student', studentId, batchId } })); } catch (e) {}
          }, 10);
        }
      } else {
        if (trainerId) {
          setTimeout(() => {
            try { window.dispatchEvent(new CustomEvent('owner:resolved', { detail: { role: 'trainer', trainerId } })); } catch (e) {}
          }, 10);
        }
      }
    } catch (e) {}
  }, [role, studentId, trainerId, batchId]);

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
        const completedIds: Set<string> = new Set((data?.completedLessonIds || []).map((x: any) => String(x)));
        if (!active) return;
        setCurriculum((prev) => {
          const updated = prev.map(s => ({ ...s, lessons: s.lessons.map(l => ({ ...l, completed: completedIds.has(String(l.id)) })) }));
          // Dispatch completion-confirmed events so other clients (main content) can sync on load
          try {
            setTimeout(() => {
              for (const id of Array.from(completedIds)) {
                try {
                  window.dispatchEvent(new CustomEvent('lesson:completion-confirmed', { detail: { lessonId: id, completed: true } }));
                } catch (e) {}
              }
            }, 10);
          } catch (e) {}
          return updated;
        });
      } catch (e) {
        // ignore
      }
    })();
    return () => { active = false };
  }, [courseId, role, studentId, trainerId, batchId]);

  useEffect(() => {
    // Initialize selected lesson to first not-completed or first lesson
    const all = curriculum.flatMap(s => s.lessons || []);
    const current = all.find(l => !l.completed) || all[0];
    if (current && !selectedLessonId) setSelectedLessonId(current.id);
  }, [curriculum]);

  const allLessons = curriculum.flatMap(s => s.lessons || []);
  const completedLessons = allLessons.filter(l => l.completed).length;
  const totalLessons = allLessons.length;
  const progress = totalLessons ? Math.round((completedLessons / totalLessons) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 sticky top-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-gray-900">Course Content</h2>
        <div className="text-sm text-gray-500">{progress}%</div>
      </div>

      <div className="space-y-4 max-h-[600px] overflow-y-auto">
        <Accordion type="multiple" defaultValue={curriculum.map(s => s.id)} className="w-full">
          {curriculum.map(section => (
            <AccordionItem value={section.id} key={section.id}>
              <AccordionTrigger className="px-4 py-3 font-semibold text-sm hover:bg-gray-100">
                <div className="flex items-center justify-between w-full">
                  <span>{section.title}</span>
                  <span className="text-sm text-gray-500 bg-white px-2 py-1 rounded-full">{section.lessons.length} lessons</span>
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <ul className="divide-y divide-gray-200">
                  {section.lessons.map((lesson, idx) => (
                    <li key={lesson.id} onClick={() => {
                      setSelectedLessonId(lesson.id);
                      window.dispatchEvent(new CustomEvent('lesson:selected', { detail: { lessonId: lesson.id, sectionId: section.id } }));
                    }} className={`flex items-center gap-4 px-4 py-3 cursor-pointer ${lesson.completed ? 'opacity-90' : ''} ${selectedLessonId === lesson.id ? 'bg-blue-50 rounded-md' : ''}`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold ${lesson.completed ? 'bg-green-500' : 'bg-gray-400'}`}>{idx+1}</div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          {getIcon(lesson)}
                          <span className={`text-sm ${lesson.completed ? 'text-green-600 font-medium' : ''}`}>{lesson.title}</span>
                        </div>
                        {(Number(lesson.duration) || 0) > 0 && <p className="text-xs text-gray-500 mt-1">{Math.floor((Number(lesson.duration)||0)/60)}m {(Number(lesson.duration)||0)%60}s</p>}
                      </div>
                      <CompletionToggle
                        lessonId={lesson.id}
                        sectionId={section.id}
                        courseId={courseId}
                        completed={Boolean(lesson.completed)}
                        role={role}
                        studentId={studentId}
                        trainerId={trainerId}
                        batchId={batchId}
                      />
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>

      <div className="mt-6 pt-6 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-bold text-gray-900">{completedLessons}</div>
            <div className="text-xs text-gray-500">Completed</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{Math.max(0, totalLessons - completedLessons)}</div>
            <div className="text-xs text-gray-500">Remaining</div>
          </div>
          <div>
            <div className="text-lg font-bold text-gray-900">{totalLessons}</div>
            <div className="text-xs text-gray-500">Lessons</div>
          </div>
        </div>
      </div>
    </div>
  );
}
