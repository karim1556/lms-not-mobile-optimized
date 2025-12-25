"use client"

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Image from "next/image";
import Link from "next/link";
import { Clock, BookOpen, Users, Globe, Tag, CheckCircle2, Share2, Link as LinkIcon } from "lucide-react";

export default function LevelDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const levelId = Number(params?.levelId);
  const [level, setLevel] = useState<any | null>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [aboutExpanded, setAboutExpanded] = useState(false);

  useEffect(() => {
    if (!Number.isFinite(levelId)) return;
    (async () => {
      const [lRes, cRes] = await Promise.all([
        fetch(`/api/levels/${levelId}`),
        fetch(`/api/levels/${levelId}/courses`),
      ]);
      const parseJsonSafely = async (res: Response) => {
        try {
          const text = await res.text();
          if (!text) return null;
          return JSON.parse(text);
        } catch (err) {
          return null;
        }
      };

      const l = await parseJsonSafely(lRes);
      setLevel(l?.error ? null : l);
      const c = await parseJsonSafely(cRes);
      setCourses(Array.isArray(c) ? c : []);
    })();
  }, [levelId]);

  const numeric = (v: any) => (typeof v === 'string' ? parseFloat(v) : (v || 0));

  if (!Number.isFinite(levelId)) return <div className="p-6">Invalid level</div>;

  const copyLink = async () => {
      try {
      await navigator.clipboard.writeText(window.location.href);
      // simple UX without external toasts (silent)
    } catch {
      alert('Link copy failed');
    }
  };

  // Group courses by label for three columns
  const groupedCourses = useMemo(() => {
    const groups: Record<string, any[]> = { Easy: [], Intermediate: [], Advanced: [] };
    courses.forEach((c) => {
      const label = c.label || "Easy";
      if (!groups[label]) groups[label] = [];
      groups[label].push(c);
    });
    return groups;
  }, [courses]);

  return (
    <div className="min-h-screen bg-white">
      {/* Breadcrumbs */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 pt-4">
        <div className="text-sm text-gray-600 flex items-center gap-2">
          <Link href="/" className="hover:underline">Home</Link>
          <span>/</span>
          <Link href="/courses" className="hover:underline">Courses</Link>
          <span>/</span>
          <span className="text-gray-900 font-medium">{level?.name || 'Level'}</span>
        </div>
      </div>

      {/* Compact info header (no big banner) */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Left: title and meta */}
            <div>
              <div className="flex items-center gap-2 mb-1">
                {level?.category && <Badge variant="secondary" className="bg-white/80">{level.category}</Badge>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">{level?.name || 'Level'}</h1>
              {level?.subtitle && (
                <p className="text-gray-600 mt-1 max-w-3xl">{level.subtitle}</p>
              )}
              {(level?.estimated_duration || level?.language || level?.category) && (
                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
                  {level?.estimated_duration && <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-gray-800 border"><Clock className="h-4 w-4" />{`Weeks ${String(level.estimated_duration).trim()}`}</span>}
                  {level?.language && <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-gray-800 border"><Globe className="h-4 w-4" />{level.language}</span>}
                  {level?.category && <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-gray-800 border"><Tag className="h-4 w-4" />{level.category}</span>}
                </div>
              )}
            </div>
            {/* Right: actions */}
            <div className="shrink-0">
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={copyLink}><LinkIcon className="h-4 w-4 mr-2" />Copy link</Button>
                <Button variant="outline" onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: level?.name || 'Level', url: window.location.href });
                  } else {
                    copyLink();
                  }
                }}>
                  <Share2 className="h-4 w-4 mr-2" /> Share
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 2xl:px-12 py-10">
        {/* Info chips were duplicated with header; removed here to avoid repetition */}

        {/* Two-column content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left main */}
          <div className="lg:col-span-2">
            <div className="mb-2 text-[11px] uppercase tracking-wider text-gray-500">Overview</div>
            {/* About / Skeleton */}
            {!level ? (
              <div className="space-y-6">
                <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
                  <div className="h-40 bg-gray-100 animate-pulse rounded-xl" />
                </div>
              </div>
            ) : level?.description && (
              <Card className="mb-6" id="about">
                <CardContent className="p-6">
                  <h2 className="text-2xl font-bold mb-2">About this level</h2>
                  <p className="text-gray-700 leading-7 whitespace-pre-line">
                    {aboutExpanded || (level.description as string).length <= 300
                      ? level.description
                      : `${(level.description as string).slice(0, 300)}...`}
                  </p>
                  {(level.description as string).length > 300 && (
                    <Button variant="link" className="px-0" onClick={() => setAboutExpanded((v) => !v)}>
                      {aboutExpanded ? 'Show less' : 'Read more'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )}

            {(level?.what_you_will_learn || level?.who_is_this_for || level?.prerequisites || level?.included_courses_note) && (
              <>
                <div className="mb-2 text-[11px] uppercase tracking-wider text-gray-500">Details</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                {level?.what_you_will_learn && (
                  <Card id="learn" className="border-emerald-200">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50"><CheckCircle2 className="h-5 w-5 text-emerald-600" /></span>
                        <h3 className="text-lg font-semibold">What you will learn</h3>
                      </div>
                      <ul className="grid gap-2">
                        {(level.what_you_will_learn as string).split(/\r?\n/).filter(Boolean).map((line, idx) => (
                          <li key={idx} className="flex items-start gap-2 text-gray-800">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            <span>{line.trim()}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                {level?.who_is_this_for && (
                  <Card className="border-indigo-200">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50"><Users className="h-5 w-5 text-indigo-600" /></span>
                        <h3 className="text-lg font-semibold">Who is this for?</h3>
                      </div>
                      <p className="text-gray-800 whitespace-pre-line">{level.who_is_this_for}</p>
                    </CardContent>
                  </Card>
                )}
                {level?.prerequisites && (
                  <Card className="border-pink-200">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pink-50"><Tag className="h-5 w-5 text-pink-600" /></span>
                        <h3 className="text-lg font-semibold">Prerequisites</h3>
                      </div>
                      <p className="text-gray-800 whitespace-pre-line">{level.prerequisites}</p>
                    </CardContent>
                  </Card>
                )}
                {level?.included_courses_note && (
                  <Card className="border-blue-200">
                    <CardContent className="p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-50"><BookOpen className="h-5 w-5 text-blue-600" /></span>
                        <h3 className="text-lg font-semibold">Included courses</h3>
                      </div>
                      <p className="text-gray-800 whitespace-pre-line">{level.included_courses_note}</p>
                    </CardContent>
                  </Card>
                )}
                </div>
              </>
            )}
          </div>

          {/* Right sticky sidebar: compact courses list */}
          <aside className="lg:col-span-1">
            <div className="sticky top-6">
              <Card>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-base mb-3">Courses in this level</h3>
                  {Object.entries(groupedCourses).map(([label, group]) => (
                    group.length > 0 && (
                      <div key={label} className="mb-4">
                        <div className={`font-bold text-sm mb-2 px-2 py-1 rounded ${label === 'Easy' ? 'bg-blue-50 border border-blue-300' : label === 'Intermediate' ? 'bg-green-50 border border-green-300' : 'bg-orange-50 border border-orange-300'}`}>{label}</div>
                        <div className="space-y-3">
                          {group.map((c) => (
                            <Link key={c.id} href={`/courses/${c.id}`} className="block">
                              <div className="flex gap-3 p-3 rounded-lg border hover:bg-gray-50 transition bg-white">
                                <Image src={c.image || '/placeholder.svg'} alt={c.title} width={96} height={60} className="rounded object-cover w-[96px] h-[60px]" />
                                <div className="min-w-0 flex-1">
                                  <p className="text-base font-semibold text-gray-900 leading-5 line-clamp-2">{c.title}</p>
                                  <div className="mt-1.5 flex items-center justify-between">
                                    {c.is_free ? (
                                      <span className="text-sm font-semibold text-green-600">Free</span>
                                    ) : (
                                      <div className="flex items-baseline gap-2">
                                        <span className="text-base font-bold text-pink-600">₹{c.price}</span>
                                        {c.original_price && <span className="text-sm text-gray-400 line-through">₹{c.original_price}</span>}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                  {courses.length === 0 && (
                    <div className="text-sm text-gray-600">No courses assigned yet.</div>
                  )}
                </CardContent>
              </Card>
            </div>
          </aside>
        </div>

        {/* New Section: Courses by Difficulty */}
        <div className="my-12">
          <h2 className="text-3xl font-bold text-center mb-2">Courses by Difficulty</h2>
          <p className="text-center text-gray-600 mb-8">Choose a course based on your skill level and interests.</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { label: "Easy", color: "blue" },
              { label: "Intermediate", color: "green" },
              { label: "Advanced", color: "orange" }
            ].map(({ label, color }) => (
              <div key={label} className={`rounded-xl border-2 border-${color}-400 bg-white shadow-sm p-6 min-h-[320px] flex flex-col`}>
                <h3 className="text-xl font-bold mb-4 text-center">{label}</h3>
                {groupedCourses[label].length === 0 ? (
                  <div className="text-gray-400 text-center">No {label.toLowerCase()} courses yet.</div>
                ) : (
                  groupedCourses[label].map((c) => (
                    <div key={c.id} className="mb-6 last:mb-0 flex flex-col items-center">
                      <Image src={c.image || '/placeholder.svg'} alt={c.title} width={64} height={64} className="rounded-full mb-2 object-cover" />
                      <div className="font-semibold text-lg text-gray-900 text-center">{c.title}</div>
                      {c.label === 'Easy' && (
                        <span className="bg-yellow-300 text-xs font-bold px-2 py-1 rounded mt-1 mb-1">Most Beginners Start Here</span>
                      )}
                      <div className="text-gray-600 text-sm text-center mb-2">{c.description || c.provider || ''}</div>
                      <Link href={`/courses/${c.id}`}>
                        <Button className="bg-orange-500 hover:bg-orange-600 text-white font-bold px-4 py-2 rounded shadow">Learn More</Button>
                      </Link>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
