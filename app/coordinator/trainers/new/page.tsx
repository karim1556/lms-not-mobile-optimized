"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { RoleLayout } from "@/components/layout/role-layout"
import { CoordinatorSidebar } from "@/components/layout/coordinator-sidebar"
import { MultiStepForm } from "@/components/forms/multi-step-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
// Removed Select imports as school/coordinator dropdowns are not needed
import { User, Lock, GraduationCap, Share2, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Protect, useOrganization } from "@clerk/nextjs"
import { supabase } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export default function CoordinatorAddTrainerPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { organization } = useOrganization()

  const [schoolName, setSchoolName] = useState<string>("")
  const [schoolId, setSchoolId] = useState<string>("")
  // coordinator is the logged-in user; no manual selection needed
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [gender, setGender] = useState<string>("male")
  const [dob, setDob] = useState<string>("")
  const [pincode, setPincode] = useState("")
  const [address, setAddress] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  // removed status verification logic
  const [email, setEmail] = useState("")
  const [highestSchool, setHighestSchool] = useState("")
  const [experienceYears, setExperienceYears] = useState<string>("")
  const [specialization, setSpecialization] = useState("")
  const [certifications, setCertifications] = useState("")
  const [phone, setPhone] = useState("")
  const [inviteMode, setInviteMode] = useState<boolean>(true)
  // removed linkedin, twitter, bio fields
  // removed single-verified gate; allow multiple trainers

  useEffect(() => {
    const init = async () => {
      try {
        try { await fetch('/api/sync/me', { method: 'POST', cache: 'no-store' }) } catch {}
        const sres = await fetch('/api/me/school', { cache: 'no-store' })
        const s = sres.ok ? await sres.json() : null
        if (s?.schoolId) {
          setSchoolId(s.schoolId)
          setSchoolName(s?.name || organization?.name || '')
        }
        // no dropdown of other schools; we keep only resolved schoolId/name
      } catch {}
    }
    init()
  }, [organization?.name])

  useEffect(() => {
    const loadCoordinators = async () => {
      if (!schoolId) {
          return
        }
      try {
        // No UI selection; optional: validate current user is coordinator of this school
        await fetch(`/api/coordinators?schoolId=${schoolId}`, { cache: 'no-store' }).catch(() => {})
      } catch (_) {}
    }
    loadCoordinators()
  }, [schoolId])

  const steps = [
    { id: "basic", title: "Basic info", icon: User },
    { id: "credentials", title: "Login credentials", icon: Lock },
    { id: "qualification", title: "Qualification", icon: GraduationCap },
    { id: "social", title: "Social information", icon: Share2 },
    { id: "finish", title: "Finish", icon: CheckCircle },
  ]

  // Validation function for each step
  const validateStep = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: // Basic info
        if (!firstName?.trim()) {
          toast({ title: "First name is required", variant: "destructive" })
          return false
        }
        if (!lastName?.trim()) {
          toast({ title: "Last name is required", variant: "destructive" })
          return false
        }
        if (!gender) {
          toast({ title: "Gender is required", variant: "destructive" })
          return false
        }
        if (!dob) {
          toast({ title: "Date of birth is required", variant: "destructive" })
          return false
        }
        return true
      case 1: // Login credentials
        if (!email?.trim()) {
          toast({ title: "Email is required", variant: "destructive" })
          return false
        }
        return true
      default:
        return true
    }
  }

  const handleComplete = async () => {
    try {
      // support multiple emails separated by commas
      const emails = (email || "")
        .split(',')
        .map(e => e.trim())
        .filter(Boolean)
      if (emails.length === 0) {
        toast({ title: "Email is required", variant: "destructive" })
        return
      }
      let success = 0
      let lastError: string | null = null
        for (const em of emails) {
        const res = await fetch("/api/trainers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            school_id: schoolId || null,
            coordinator_id: null,
            first_name: firstName || null,
            last_name: lastName || null,
            gender: gender || null,
            dob: dob || null,
            pincode: pincode || null,
            address: address || null,
            image_url: imageUrl || null,
            // status removed
            email: em,
            highest_school: highestSchool || null,
            experience_years: experienceYears ? Number(experienceYears) : null,
            specialization: specialization || null,
            certifications: certifications || null,
            phone: phone || null,
            // send invite instead of creating verified trainer directly when inviteMode is true
            invite: inviteMode,
          }),
        })
        let data: any = null
        try { data = await res.json() } catch {}
        if (res.ok) {
          success += 1
        } else {
          const msg = data?.error || data?.message || (await res.text().catch(() => "Failed to create trainer"))
          lastError = `${res.status} ${res.statusText}: ${msg}`
        }
      }
      if (success > 0) {
        toast({ title: `${success} trainer${success>1?'s':''} created` })
        router.push("/coordinator/trainers")
      } else {
        throw new Error(lastError || 'Failed to create trainer(s)')
      }
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || String(e) || "Failed to create trainer", variant: "destructive" })
    }
  }

  const stepContent = [
    // Basic Info Step
    <div key="basic" className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="school">School</Label>
        <Input id="school" value={schoolName} readOnly disabled />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="firstName">First Name<span className="text-red-500">*</span></Label>
          <Input id="firstName" placeholder="Enter first name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last Name<span className="text-red-500">*</span></Label>
          <Input id="lastName" placeholder="Enter last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-3">
        <Label>Gender<span className="text-red-500">*</span></Label>
        <RadioGroup value={gender} onValueChange={setGender} className="flex gap-6">
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="male" id="male" />
            <Label htmlFor="male">Male</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="female" id="female" />
            <Label htmlFor="female">Female</Label>
          </div>
        </RadioGroup>
      </div>
      <div className="space-y-2">
        <Label htmlFor="dob">Date of Birth<span className="text-red-500">*</span></Label>
        <Input id="dob" type="date" value={dob} onChange={(e) => setDob(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="pincode">Pincode</Label>
        <Input id="pincode" placeholder="Enter pincode" value={pincode} onChange={(e) => setPincode(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" placeholder="Enter address" rows={4} value={address} onChange={(e) => setAddress(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="profileImage">Profile Image</Label>
        <Input id="profileImage" type="file" accept="image/*" onChange={async (e) => {
          const file = e.target.files?.[0]
          if (!file) return
          try {
            const fileName = `trainer-profiles/${Date.now()}-${file.name}`
            const { error } = await supabase.storage.from("course-thumbnails").upload(fileName, file)
            if (error) throw error
            const { data } = supabase.storage.from("course-thumbnails").getPublicUrl(fileName)
            setImageUrl(data.publicUrl)
            toast({ title: "Profile image uploaded" })
          } catch (err: any) {
            toast({ title: "Image upload failed", description: err?.message || "", variant: "destructive" })
          }
        }} />
        {imageUrl && (
          <p className="text-xs text-gray-500 break-all">Uploaded: {imageUrl}</p>
        )}
      </div>
      {/* Status selection removed */}
    </div>,

    // Login Credentials Step
    <div key="credentials" className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email(s)<span className="text-red-500">*</span></Label>
        <Input id="email" type="text" placeholder="Enter one or more emails, separated by commas" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="flex items-center space-x-3">
        <input id="inviteMode" type="checkbox" checked={inviteMode} onChange={(e) => setInviteMode(e.target.checked)} className="h-4 w-4 rounded" />
        <div className="text-sm">
          <Label htmlFor="inviteMode" className="!mb-0">Send invitation (recommended)</Label>
          <p className="text-xs text-gray-500">When checked, an invitation will be sent and the trainer will be stored as "invited". When unchecked, an account will be created directly.</p>
        </div>
      </div>
    </div>,

    // Qualification Step
    <div key="qualification" className="space-y-6">
      <div className="space-y-2">
        <Label>Qualification</Label>
        <Select value={highestSchool} onValueChange={setHighestSchool}>
          <SelectTrigger>
            <SelectValue placeholder="Select qualification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="12th">12th</SelectItem>
            <SelectItem value="Graduate Commerce">Graduate Commerce</SelectItem>
            <SelectItem value="Graduate Art">Graduate Art</SelectItem>
            <SelectItem value="Diploma">Diploma</SelectItem>
            <SelectItem value="Degree of Engg">Degree of engg</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="experience">Experience (Years)</Label>
        <Input id="experience" type="number" placeholder="Enter years of experience" value={experienceYears} onChange={(e) => setExperienceYears(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="specialization">Specialization</Label>
        <Input id="specialization" placeholder="Enter specialization" value={specialization} onChange={(e) => setSpecialization(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="certifications">Certifications</Label>
        <Textarea id="certifications" placeholder="Enter certifications" rows={4} value={certifications} onChange={(e) => setCertifications(e.target.value)} />
      </div>
    </div>,

    // Social Information Step
    <div key="social" className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input id="phone" placeholder="Enter phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
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

  // Always allow adding trainers; no single-verified restriction

  return (
    <Protect
    role="schoolcoordinator"
    fallback={<p>Access denied</p>}
    >
    <RoleLayout title="Coordinator" subtitle="Add Trainer" Sidebar={CoordinatorSidebar}>
      <MultiStepForm steps={steps} onComplete={handleComplete} onBeforeNext={validateStep}>
        {stepContent}
      </MultiStepForm>
    </RoleLayout>
    </Protect>
  )
}
