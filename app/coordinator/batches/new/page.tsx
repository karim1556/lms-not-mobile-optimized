"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { RoleLayout } from "@/components/layout/role-layout"
import { CoordinatorSidebar } from "@/components/layout/coordinator-sidebar"
import { MultiStepForm } from "@/components/forms/multi-step-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
// Removed school/course Select UI
import { User, Users, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import { Protect, useOrganization } from "@clerk/nextjs" 

export default function CoordinatorAddBatchPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { organization, isLoaded: orgLoaded } = useOrganization()
  const [name, setName] = useState("")
  // School and course are derived server-side; no UI
  const [schoolId] = useState<string>("")
  const [courseId] = useState<string>("")
  const [status, setStatus] = useState<string>("verified")
  const [maxStudents, setMaxStudents] = useState<string>("30")
  const [startDate, setStartDate] = useState<string>("")
  const [endDate, setEndDate] = useState<string>("")
  const [schedule, setSchedule] = useState<string>("")
  const [description, setDescription] = useState<string>("")
  // Removed schools/courses lists
  const [trainers, setTrainers] = useState<Array<{ id: string; first_name?: string; last_name?: string }>>([])
  const [students, setStudents] = useState<Array<{ id: string; first_name?: string; last_name?: string }>>([])
  const [selectedTrainerIds, setSelectedTrainerIds] = useState<Set<string>>(new Set())
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!orgLoaded) return
    const load = async () => {
      try {
        const stdRes = await fetch("/api/students")
        const std = await stdRes.json()
        setStudents(Array.isArray(std) ? std : [])
      } catch (_) {}
    }
    load()
  }, [orgLoaded, organization?.name])

  useEffect(() => {
    const loadTrainers = async () => {
      try {
        const res = await fetch("/api/trainers")
        const data = await res.json()
        setTrainers(Array.isArray(data) ? data : [])
      } catch (_) {}
    }
    loadTrainers()
  }, [])

  const steps = [
    { id: "basic", title: "Basic info", icon: User },
    { id: "students", title: "Students", icon: Users },
    { id: "finish", title: "Finish", icon: CheckCircle },
  ]

  const validateBeforeNext = async (currentStep: number) => {
    // Validate Basic Info step
    if (currentStep === 0) {
      const trimmedName = (name || "").trim()
      if (!trimmedName) {
        toast({ title: "Batch name required", variant: "destructive" })
        return false
      }
    }
    // Validate Students step fields before moving to Finish
    if (currentStep === 1) {
      const maxStudentsNum = Number(maxStudents)
      if (maxStudents && (Number.isNaN(maxStudentsNum) || maxStudentsNum < 1)) {
        toast({ title: "Maximum students must be a positive number", variant: "destructive" })
        return false
      }
      // require start and end dates
      if (!startDate) {
        toast({ title: "Start date is required", variant: "destructive" })
        return false
      }
      if (!endDate) {
        toast({ title: "End date is required", variant: "destructive" })
        return false
      }
      if (isNaN(Date.parse(startDate))) {
        toast({ title: "Start date is invalid", variant: "destructive" })
        return false
      }
      if (isNaN(Date.parse(endDate))) {
        toast({ title: "End date is invalid", variant: "destructive" })
        return false
      }
      if (Date.parse(startDate) > Date.parse(endDate)) {
        toast({ title: "Start date must be before end date", variant: "destructive" })
        return false
      }
      const trimmedSchedule = (schedule || "").trim()
      const trimmedDescription = (description || "").trim()
      if (!trimmedSchedule) {
        toast({ title: "Schedule is required", variant: "destructive" })
        return false
      }
      if (trimmedSchedule.length > 200) {
        toast({ title: "Schedule too long (max 200 chars)", variant: "destructive" })
        return false
      }
      if (!trimmedDescription) {
        toast({ title: "Description is required", variant: "destructive" })
        return false
      }
      if (trimmedDescription.length > 1000) {
        toast({ title: "Description too long (max 1000 chars)", variant: "destructive" })
        return false
      }
    }

    return true
  }

  const stepContent = [
    // Basic Info Step
    <div key="basic" className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="batchName">Batch Name<span className="text-red-500">*</span></Label>
        <Input id="batchName" placeholder="Enter batch name" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div className="space-y-3">
        <Label>Status<span className="text-red-500">*</span></Label>
        <RadioGroup value={status} onValueChange={setStatus} className="flex gap-6">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="verified" id="verified" />
            <Label htmlFor="verified">Verified</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="unverified" id="unverified" />
            <Label htmlFor="unverified">Unverified</Label>
          </div>
        </RadioGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor="trainers">Assign Trainers (multi-select)</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {trainers.map((t) => {
            const id = t.id
            const label = `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() || id
            const checked = selectedTrainerIds.has(id)
            return (
              <label key={id} className="flex items-center gap-2 rounded border p-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    setSelectedTrainerIds((prev) => {
                      const next = new Set(prev)
                      if (v) next.add(id)
                      else next.delete(id)
                      return next
                    })
                  }}
                />
                <span className="text-sm">{label}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>,

    // Students Step
    <div key="students" className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="maxStudents">Maximum Students<span className="text-red-500">*</span></Label>
        <Input id="maxStudents" type="number" min={1} placeholder="Enter maximum number of students" value={maxStudents} onChange={(e) => {
          const v = e.target.value
          setMaxStudents(v)
          // Trim current selection if it exceeds new max
          const max = Number(v) || 0
          if (max > 0 && selectedStudentIds.size > max) {
            const trimmed = new Set(Array.from(selectedStudentIds).slice(0, max))
            setSelectedStudentIds(trimmed)
          }
        }} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="startDate">Start Date<span className="text-red-500">*</span></Label>
        <Input id="startDate" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="endDate">End Date<span className="text-red-500">*</span></Label>
        <Input id="endDate" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="schedule">Schedule<span className="text-red-500">*</span></Label>
        <Input id="schedule" placeholder="Enter batch schedule (e.g., Mon-Fri 10:00-12:00)" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="description">Description<span className="text-red-500">*</span></Label>
        <Input id="description" placeholder="Enter batch description" value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label>Assign Students (multi-select; global)</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {students.map((s) => {
            const id = s.id
            const label = `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || id
            const checked = selectedStudentIds.has(id)
            return (
              <label key={id} className="flex items-center gap-2 rounded border p-2">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    setSelectedStudentIds((prev) => {
                      const max = Number(maxStudents) || 0
                      const next = new Set(prev)
                      if (v) {
                        if (max === 0 || next.size < max) next.add(id)
                      } else {
                        next.delete(id)
                      }
                      return next
                    })
                  }}
                />
                <span className="text-sm">{label}</span>
              </label>
            )
          })}
        </div>
      </div>
    </div>,

    // Finish Step
    <div key="finish" className="space-y-6 text-center">
      <div className="space-y-4">
        <CheckCircle className="h-16 w-16 text-green-500 mx-auto" />
        <h3 className="text-xl font-semibold">Review Your Information</h3>
        <p className="text-gray-600">Please review all the information you have entered before submitting.</p>
      </div>
    </div>,
  ]

  const handleComplete = async () => {
    try {
      const trimmedName = (name || "").trim()
      if (!trimmedName) {
        toast({ title: "Batch name required", variant: "destructive" })
        return
      }
      const trimmedSchedule = (schedule || "").trim()
      const trimmedDescription = (description || "").trim()

      // Validate max students
      const maxStudentsNum = Number(maxStudents)
      if (maxStudents && (Number.isNaN(maxStudentsNum) || maxStudentsNum < 1)) {
        toast({ title: "Maximum students must be a positive number", variant: "destructive" })
        return
      }

      // Require start and end dates
      if (!startDate) {
        toast({ title: "Start date is required", variant: "destructive" })
        return
      }
      if (!endDate) {
        toast({ title: "End date is required", variant: "destructive" })
        return
      }
      if (isNaN(Date.parse(startDate))) {
        toast({ title: "Start date is invalid", variant: "destructive" })
        return
      }
      if (isNaN(Date.parse(endDate))) {
        toast({ title: "End date is invalid", variant: "destructive" })
        return
      }
      if (Date.parse(startDate) > Date.parse(endDate)) {
        toast({ title: "Start date must be before end date", variant: "destructive" })
        return
      }

      // Validate schedule/description required & lengths
      if (!trimmedSchedule) {
        toast({ title: "Schedule is required", variant: "destructive" })
        return
      }
      if (trimmedSchedule.length > 200) {
        toast({ title: "Schedule too long (max 200 chars)", variant: "destructive" })
        return
      }
      if (!trimmedDescription) {
        toast({ title: "Description is required", variant: "destructive" })
        return
      }
      if (trimmedDescription.length > 1000) {
        toast({ title: "Description too long (max 1000 chars)", variant: "destructive" })
        return
      }

      const res = await fetch("/api/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          school_id: null,
          course_id: null,
          start_date: startDate || null,
          end_date: endDate || null,
          max_students: maxStudents || null,
          status,
          schedule: trimmedSchedule || null,
          description: trimmedDescription || null,
          trainerIds: Array.from(selectedTrainerIds),
          studentIds: Array.from(selectedStudentIds),
        }),
      })
      let data: any = null
      try { data = await res.json() } catch (_) {}
      if (!res.ok) {
        const msg = data?.error || data?.message || (await res.text().catch(() => "Failed to create batch"))
        throw new Error(`${res.status} ${res.statusText}: ${msg}`)
      }
      toast({ title: "Batch created" })
      router.push("/coordinator/dashboard")
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || String(e) || "Failed to create batch", variant: "destructive" })
    }
  }

  return (
    <Protect
    role="schoolcoordinator"
    fallback={<p>Access denied</p>}
    >
    <RoleLayout title="Coordinator" subtitle="Create Batch" Sidebar={CoordinatorSidebar}>
      <MultiStepForm steps={steps} onComplete={handleComplete} onBeforeNext={validateBeforeNext}>
        {stepContent}
      </MultiStepForm>
    </RoleLayout>
    </Protect>
  )
}
