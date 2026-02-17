"use client"

import { useEffect, useMemo, useState } from "react"
import StandardDashboard from "@/components/dashboard/StandardDashboard"
import { BookOpen, Video, UserCheck, Users, GraduationCap, Calendar } from "lucide-react"
import { RoleLayout } from "@/components/layout/role-layout"
import { TrainerSidebar } from "@/components/layout/trainer-sidebar"
import { useDashboardStats } from "@/hooks/use-dashboard-stats"
import { OrganizationSwitcher, useAuth, useOrganization, useUser } from "@clerk/nextjs"
import { useRouter } from "next/navigation"

export default function TrainerDashboard() {
  const { counts } = useDashboardStats()
  const { isSignedIn, isLoaded: authLoaded } = useAuth()
  const { organization, isLoaded: orgLoaded } = useOrganization()
  const { user, isLoaded: userLoaded } = useUser()
  const router = useRouter()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [schoolId, setSchoolId] = useState<string | null>(null)
  const [schoolName, setSchoolName] = useState<string | null>(null)
  const [trainers, setTrainers] = useState<any[]>([])
  const [students, setStudents] = useState<any[]>([])
  const [batches, setBatches] = useState<any[]>([])

  // One-time sync
  useEffect(() => {
    if (!authLoaded || !orgLoaded) return
    if (!isSignedIn || !organization?.id) return
    let done = false
    ;(async () => {
      if (done) return
      try { await fetch('/api/sync/me', { method: 'POST', cache: 'no-store' }) } catch {}
      done = true
    })()
  }, [authLoaded, orgLoaded, isSignedIn, organization?.id])

  // Load school-scoped data
  useEffect(() => {
    if (!authLoaded || !orgLoaded || !userLoaded) return
    if (!isSignedIn || !organization?.id) return
    let active = true
    ;(async () => {
      setLoading(true)
      setError(null)
      try {
        try { await fetch('/api/sync/me', { method: 'POST', cache: 'no-store' }) } catch {}
        const schoolRes = await fetch('/api/me/school', { cache: 'no-store' })
        if (!schoolRes.ok) throw new Error('Failed to resolve school')
        const school = await schoolRes.json()
        const sid = school?.schoolId
        if (!sid) throw new Error('No school linked to this organization')
        if (!active) return
        setSchoolId(sid)
        setSchoolName(school?.name ?? null)

        const [bRes, tRes, sRes] = await Promise.all([
          fetch(`/api/batches?schoolId=${encodeURIComponent(sid)}`, { cache: 'no-store' }),
          fetch(`/api/trainers?schoolId=${encodeURIComponent(sid)}`, { cache: 'no-store' }),
          fetch(`/api/students?schoolId=${encodeURIComponent(sid)}`, { cache: 'no-store' }),
        ])
        if (!bRes.ok) throw new Error('Failed to load batches')
        if (!tRes.ok) throw new Error('Failed to load trainers')
        if (!sRes.ok) throw new Error('Failed to load students')
        const [bjson, tjson, sjson] = await Promise.all([bRes.json(), tRes.json(), sRes.json()])
        if (!active) return
        setBatches(Array.isArray(bjson) ? bjson : [])
        setTrainers(Array.isArray(tjson) ? tjson : [])
        setStudents(Array.isArray(sjson) ? sjson : [])
      } catch (e:any) {
        if (!active) return
        setError(e?.message || 'Failed to load trainer data')
      } finally {
        if (active) setLoading(false)
      }
    })()
    return () => { active = false }
  }, [authLoaded, orgLoaded, userLoaded, isSignedIn, organization?.id])

  // Identify current trainer record by email match
  const myTrainer = useMemo(() => {
    const email = user?.primaryEmailAddress?.emailAddress?.toLowerCase()
    if (!email) {
      console.log('[Trainer Dashboard] No email found for user')
      return null
    }
    const trainer = trainers.find((t:any) => (t.email || '').toLowerCase() === email) || null
    console.log('[Trainer Dashboard] Looking for trainer with email:', email)
    console.log('[Trainer Dashboard] Available trainers:', trainers.map(t => ({ id: t.id, email: t.email })))
    console.log('[Trainer Dashboard] Found trainer:', trainer ? { id: trainer.id, email: trainer.email, name: `${trainer.first_name} ${trainer.last_name}` } : 'NOT FOUND')
    return trainer
  }, [trainers, user?.primaryEmailAddress?.emailAddress])

  // Filter my batches by membership in batch_trainers
  const myTrainerId = myTrainer?.id as string | undefined
  const myBatchesList = useMemo(() => {
    if (!myTrainerId) {
      console.log('[Trainer Dashboard] No trainer ID found, cannot filter batches')
      return [] as any[]
    }
    console.log('[Trainer Dashboard] Filtering batches for trainer ID:', myTrainerId)
    console.log('[Trainer Dashboard] Total batches:', batches.length)
    const filtered = batches.filter((b:any) => {
      const ids = b.trainer_ids ? String(b.trainer_ids).split(',').filter(Boolean) : []
      const isAssigned = ids.includes(myTrainerId)
      if (isAssigned) {
        console.log('[Trainer Dashboard] Batch assigned:', { name: b.name, id: b.id, trainer_ids: b.trainer_ids })
      }
      return isAssigned
    })
    console.log('[Trainer Dashboard] My batches count:', filtered.length)
    return filtered
  }, [batches, myTrainerId])

  // Compute students in my batches only
  const myStudentsCount = useMemo(() => {
    if (!myTrainerId) {
      console.log('[Trainer Dashboard] No trainer ID, students count = 0')
      return 0
    }
    const studentIds = new Set<string>()
    for (const b of batches) {
      const tids = b.trainer_ids ? String(b.trainer_ids).split(',').filter(Boolean) : []
      if (tids.includes(myTrainerId)) {
        const sids = b.student_ids ? String(b.student_ids).split(',').filter(Boolean) : []
        sids.forEach(id => studentIds.add(id))
      }
    }
    console.log('[Trainer Dashboard] Students in my batches:', studentIds.size)
    return studentIds.size
  }, [batches, myTrainerId])

  const schoolDisplay = schoolName && schoolName !== 'Unnamed School' ? schoolName : (organization?.name || (schoolId ?? null))

  const stats = [
    { label: "My Batches", value: myBatchesList.length, icon: <Calendar className="h-8 w-8" /> },
    { label: "Students", value: myStudentsCount, icon: <Users className="h-8 w-8" /> },
    { label: "Courses", value: counts.courses, icon: <BookOpen className="h-8 w-8" /> },
    { label: "Lessons", value: counts.lessons, icon: <Video className="h-8 w-8" /> },
  ]

  const secondaryStats = [
    { label: "Assignments", value: counts.assignments, icon: <Calendar className="h-8 w-8" /> },
    { label: "Trainers", value: trainers.length, icon: <GraduationCap className="h-8 w-8" /> },
  ]

  const activeCourses = counts.activeCourses
  const pendingCourses = counts.pendingCourses

  const activities = [
    { color: "bg-blue-50 hover:bg-blue-100 text-blue-600", title: "Welcome", description: schoolDisplay ? `School: ${schoolDisplay}` : "", time: "" },
  ]

  // Build message students handler: collect emails of students in my batches
  const messageStudents = () => {
    const myId = myTrainerId
    if (!myId) return
    const allowedIds = new Set<string>()
    for (const b of batches) {
      const tids = b.trainer_ids ? String(b.trainer_ids).split(',').filter(Boolean) : []
      if (tids.includes(myId)) {
        const sids = b.student_ids ? String(b.student_ids).split(',').filter(Boolean) : []
        sids.forEach((id:string) => allowedIds.add(id))
      }
    }
    const emails = students.filter((s:any) => allowedIds.has(s.id)).map((s:any) => s.email).filter(Boolean)
    const mailto = `mailto:?bcc=${encodeURIComponent(emails.join(','))}&subject=${encodeURIComponent('Message from Trainer')}`
    window.location.href = mailto
  }

  const quickActions = [
    { label: "Create Session", onClick: () => router.push('/trainer/sessions/new') },
    { label: "Post Assignment", onClick: () => router.push('/trainer/assignments/new') },
    { label: "Grade Submissions", onClick: () => router.push('/trainer/grade') },
    { label: "Message Students", onClick: messageStudents },
  ]

  // Loading / auth states
  if (!authLoaded || !orgLoaded || !userLoaded) {
    return (
      <RoleLayout title="Aiskool LMS" subtitle="Trainer Dashboard" Sidebar={TrainerSidebar}>
        <div className="p-6">Loading...</div>
      </RoleLayout>
    )
  }
  if (!isSignedIn) {
    return (
      <RoleLayout title="Aiskool LMS" subtitle="Trainer Dashboard" Sidebar={TrainerSidebar}>
        <div className="p-6">Please sign in to continue.</div>
      </RoleLayout>
    )
  }
  if (!organization) {
    return (
      <RoleLayout title="Aiskool LMS" subtitle="Trainer Dashboard" Sidebar={TrainerSidebar}>
        <div className="p-6">
          <p className="mb-3">Please select an organization to continue.</p>
          <OrganizationSwitcher />
        </div>
      </RoleLayout>
    )
  }

  return (
    <RoleLayout title="Aiskool LMS" subtitle="Trainer Dashboard" Sidebar={TrainerSidebar}>
      {!myTrainer && !loading && (
        <div className="p-6 mb-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h3 className="font-semibold text-yellow-800 mb-2">Trainer Profile Not Found</h3>
          <p className="text-sm text-yellow-700">
            Your email ({user?.primaryEmailAddress?.emailAddress}) is not registered as a trainer in this school.
            Please contact your administrator to set up your trainer account.
          </p>
        </div>
      )}
      {myTrainer && myBatchesList.length === 0 && !loading && (
        <div className="p-6 mb-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-800 mb-2">No Batches Assigned</h3>
          <p className="text-sm text-blue-700">
            You don't have any batches assigned yet. Contact your coordinator to assign batches to you.
          </p>
        </div>
      )}
      <StandardDashboard
        title="Dashboard"
        subtitle="Trainer Panel"
        stats={stats}
        secondaryStats={secondaryStats}
        totalCourses={activeCourses + pendingCourses}
        activeCourses={activeCourses}
        pendingCourses={pendingCourses}
        quickActions={quickActions}
        activities={activities}
      />
    </RoleLayout>
  )
}
