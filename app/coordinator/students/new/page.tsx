"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { RoleLayout } from "@/components/layout/role-layout"
import { CoordinatorSidebar } from "@/components/layout/coordinator-sidebar"
import { MultiStepForm } from "@/components/forms/multi-step-form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { User, Lock, Share2, CheckCircle } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { Protect } from "@clerk/nextjs"

export default function CoordinatorAddStudentPage() {
  const steps = [
    { id: "basic", title: "Basic info", icon: User },
    { id: "credentials", title: "Login credentials", icon: Lock },
    { id: "social", title: "Social information", icon: Share2 },
    { id: "finish", title: "Finish", icon: CheckCircle },
  ]

  const router = useRouter()
  const { toast } = useToast()
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [biography, setBiography] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [phone, setPhone] = useState("")
  const [parentPhone, setParentPhone] = useState("")
  const [address, setAddress] = useState("")
  const [stateVal, setStateVal] = useState("")
  const [district, setDistrict] = useState("")
  const [invite, setInvite] = useState(false)

  const stepContent = [
    // Basic Info Step
    <div key="basic" className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="firstName">First name<span className="text-red-500">*</span></Label>
          <Input id="firstName" placeholder="Enter first name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="lastName">Last name<span className="text-red-500">*</span></Label>
          <Input id="lastName" placeholder="Enter last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="biography">Biography</Label>
        <div className="border rounded-lg">
          <div className="border-b p-2 flex items-center gap-2 text-sm">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><span className="font-bold">B</span></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><span className="italic">I</span></Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0"><span className="underline">U</span></Button>
            <div className="w-px h-4 bg-gray-300" />
            <Button variant="ghost" size="sm" className="h-8 px-2">Nunito</Button>
          </div>
          <Textarea id="biography" placeholder="Write something..." className="border-0 resize-none focus-visible:ring-0" rows={8} value={biography} onChange={(e) => setBiography(e.target.value)} />
        </div>
      </div>
    </div>,

    // Login Credentials Step
    <div key="credentials" className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="email">Email<span className="text-red-500">*</span></Label>
        <Input id="email" type="email" placeholder="Enter email address" value={email} onChange={(e) => setEmail(e.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={invite}
            onChange={(e) => setInvite(e.target.checked)}
          />
          <span>Invite student via email (recommended)</span>
        </label>
        <p className="text-xs text-muted-foreground">
          When invited, the student receives an email from Clerk to set their password. We will add them as invited.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password<span className="text-red-500">*</span></Label>
        <Input id="password" type="password" placeholder="Enter password" value={password} onChange={(e) => setPassword(e.target.value)} disabled={invite} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm Password<span className="text-red-500">*</span></Label>
        <Input id="confirmPassword" type="password" placeholder="Confirm password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} disabled={invite} />
      </div>
    </div>,

    // Social Information Step
    <div key="social" className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number</Label>
        <Input id="phone" placeholder="Enter phone number" value={phone} onChange={(e) => setPhone(e.target.value)} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="parentPhone">Parent/Guardian Phone</Label>
        <Input id="parentPhone" placeholder="Enter parent/guardian phone" value={parentPhone} onChange={(e) => setParentPhone(e.target.value)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="state">State</Label>
          <Input id="state" placeholder="Enter state" value={stateVal} onChange={(e) => setStateVal(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="district">District</Label>
          <Input id="district" placeholder="Enter district" value={district} onChange={(e) => setDistrict(e.target.value)} />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="address">Address</Label>
        <Textarea id="address" placeholder="Enter address" rows={4} value={address} onChange={(e) => setAddress(e.target.value)} />
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
        return true
      case 1: // Login credentials
        if (!email?.trim()) {
          toast({ title: "Email is required", variant: "destructive" })
          return false
        }
        if (!invite) {
          if (!password) {
            toast({ title: "Password is required", variant: "destructive" })
            return false
          }
          if (!confirmPassword) {
            toast({ title: "Confirm password is required", variant: "destructive" })
            return false
          }
          if (password !== confirmPassword) {
            toast({ title: "Passwords do not match", variant: "destructive" })
            return false
          }
        }
        return true
      default:
        return true
    }
  }

  const handleComplete = async () => {
    try {
      if (!invite && password !== confirmPassword) {
        toast({ title: "Passwords do not match", variant: "destructive" })
        return
      }
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          first_name: firstName || null,
          last_name: lastName || null,
          biography,
          email: email || null,
          ...(invite ? {} : { password }),
          phone: phone || null,
          parent_phone: parentPhone,
          address,
          state: stateVal || null,
          district: district || null,
          invite,
        }),
      })
      let data: any = null
      try { data = await res.json() } catch (_) {}
      if (!res.ok) {
        const msg = data?.error || data?.message || (await res.text().catch(() => "Failed to create student"))
        throw new Error(`${res.status} ${res.statusText}: ${msg}`)
      }
      toast({ title: invite ? "Invitation sent" : "Student created" })
      router.push("/coordinator/dashboard")
    } catch (e: any) {
      toast({ title: "Error", description: e?.message || String(e) || "Failed to create student", variant: "destructive" })
    }
  }

  return (
    <Protect
    role="schoolcoordinator"
    fallback={<p>Access denied</p>}
    >
    <RoleLayout title="Coordinator" subtitle="Add Student" Sidebar={CoordinatorSidebar}>
      <MultiStepForm steps={steps} onComplete={handleComplete} onBeforeNext={validateStep}>
        {stepContent}
      </MultiStepForm>
    </RoleLayout>
    </Protect>
  )
}
