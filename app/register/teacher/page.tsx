"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, ArrowRight, Check, GraduationCap, School, FileText } from "lucide-react"                

interface TeacherFormData {
  // Personal Information
  firstName: string
  lastName: string
  email: string
  confirmEmail: string
  password: string
  confirmPassword: string
  phone: string

  // Professional Information
  schoolName: string
  schoolDistrict: string
  schoolAddress: string
  schoolCity: string
  schoolState: string
  schoolZip: string
  position: string
  yearsExperience: string
  gradesTaught: string[]
  subjectsTaught: string[]

  // Classroom Information
  classSize: string
  technologyAccess: string[]
  currentCurriculum: string
  goals: string

  // Verification
  teacherLicense: string
  schoolEmail: string
  principalName: string
  principalEmail: string

  // Preferences
  communicationPreferences: string[]
  marketingConsent: boolean
  termsAccepted: boolean
  privacyAccepted: boolean
}

const initialFormData: TeacherFormData = {
  firstName: "",
  lastName: "",
  email: "",
  confirmEmail: "",
  password: "",
  confirmPassword: "",
  phone: "",
  schoolName: "",
  schoolDistrict: "",
  schoolAddress: "",
  schoolCity: "",
  schoolState: "",
  schoolZip: "",
  position: "",
  yearsExperience: "",
  gradesTaught: [],
  subjectsTaught: [],
  classSize: "",
  technologyAccess: [],
  currentCurriculum: "",
  goals: "",
  teacherLicense: "",
  schoolEmail: "",
  principalName: "",
  principalEmail: "",
  communicationPreferences: [],
  marketingConsent: false,
  termsAccepted: false,
  privacyAccepted: false,
}

const grades = [
  "Pre-K",
  "Kindergarten",
  "1st Grade",
  "2nd Grade",
  "3rd Grade",
  "4th Grade",
  "5th Grade",
  "6th Grade",
  "7th Grade",
  "8th Grade",
  "9th Grade",
  "10th Grade",
  "11th Grade",
  "12th Grade",
]

const subjects = [
  "Computer Science",
  "Mathematics",
  "Science",
  "Technology",
  "Engineering",
  "Art",
  "Language Arts",
  "Social Studies",
  "Special Education",
  "Other",
]

const technologyOptions = [
  "Tablets/iPads",
  "Laptops",
  "Desktop Computers",
  "Interactive Whiteboards",
  "Chromebooks",
  "Robotics Kits",
  "3D Printers",
  "Limited Technology",
]

export default function TeacherRegistration() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<TeacherFormData>(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const totalSteps = 5

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const validateStep = (step: number): boolean => {
    const newErrors: Record<string, string> = {}

    if (step === 1) {
      if (!formData.firstName.trim()) newErrors.firstName = "First name is required"
      if (!formData.lastName.trim()) newErrors.lastName = "Last name is required"
      if (!formData.email.trim()) newErrors.email = "Email is required"
      else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = "Invalid email format"
      if (formData.email !== formData.confirmEmail) newErrors.confirmEmail = "Emails don't match"
      if (!formData.password) newErrors.password = "Password is required"
      else if (formData.password.length < 8) newErrors.password = "Password must be at least 8 characters"
      if (formData.password !== formData.confirmPassword) newErrors.confirmPassword = "Passwords don't match"
      if (!formData.phone.trim()) newErrors.phone = "Phone number is required"
    }

    if (step === 2) {
      if (!formData.schoolName.trim()) newErrors.schoolName = "School name is required"
      if (!formData.schoolDistrict.trim()) newErrors.schoolDistrict = "School district is required"
      if (!formData.schoolAddress.trim()) newErrors.schoolAddress = "School address is required"
      if (!formData.schoolCity.trim()) newErrors.schoolCity = "City is required"
      if (!formData.schoolState.trim()) newErrors.schoolState = "State is required"
      if (!formData.schoolZip.trim()) newErrors.schoolZip = "ZIP code is required"
      if (!formData.position) newErrors.position = "Position is required"
      if (!formData.yearsExperience) newErrors.yearsExperience = "Years of experience is required"
    }

    if (step === 3) {
      if (formData.gradesTaught.length === 0) newErrors.gradesTaught = "Please select at least one grade"
      if (formData.subjectsTaught.length === 0) newErrors.subjectsTaught = "Please select at least one subject"
      if (!formData.classSize) newErrors.classSize = "Class size is required"
    }

    if (step === 4) {
      if (!formData.teacherLicense.trim()) newErrors.teacherLicense = "Teacher license number is required"
      if (!formData.schoolEmail.trim()) newErrors.schoolEmail = "School email is required"
      if (!formData.principalName.trim()) newErrors.principalName = "Principal's name is required"
      if (!formData.principalEmail.trim()) newErrors.principalEmail = "Principal's email is required"
    }

    if (step === 5) {
      if (!formData.termsAccepted) newErrors.termsAccepted = "You must accept the terms of service"
      if (!formData.privacyAccepted) newErrors.privacyAccepted = "You must accept the privacy policy"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps))
    }
  }

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    if (!validateStep(currentStep)) return

    setIsSubmitting(true)
    try {
      await new Promise((resolve) => setTimeout(resolve, 2000))
      // Teacher registration data processed
    } catch (error) {
      console.error("Registration failed:", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <GraduationCap className="w-12 h-12 mx-auto text-sky-500 mb-2" />
              <h2 className="text-2xl font-bold text-gray-900">Personal Information</h2>
              <p className="text-gray-600">Let's start with your basic information</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={formData.firstName}
                  onChange={(e) => updateFormData("firstName", e.target.value)}
                  className={errors.firstName ? "border-red-500" : ""}
                />
                {errors.firstName && <p className="text-red-500 text-sm mt-1">{errors.firstName}</p>}
              </div>

              <div>
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={formData.lastName}
                  onChange={(e) => updateFormData("lastName", e.target.value)}
                  className={errors.lastName ? "border-red-500" : ""}
                />
                {errors.lastName && <p className="text-red-500 text-sm mt-1">{errors.lastName}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="email">Personal Email Address *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => updateFormData("email", e.target.value)}
                className={errors.email ? "border-red-500" : ""}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            <div>
              <Label htmlFor="confirmEmail">Confirm Email Address *</Label>
              <Input
                id="confirmEmail"
                type="email"
                value={formData.confirmEmail}
                onChange={(e) => updateFormData("confirmEmail", e.target.value)}
                className={errors.confirmEmail ? "border-red-500" : ""}
              />
              {errors.confirmEmail && <p className="text-red-500 text-sm mt-1">{errors.confirmEmail}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  value={formData.password}
                  onChange={(e) => updateFormData("password", e.target.value)}
                  className={errors.password ? "border-red-500" : ""}
                />
                {errors.password && <p className="text-red-500 text-sm mt-1">{errors.password}</p>}
              </div>

              <div>
                <Label htmlFor="confirmPassword">Confirm Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) => updateFormData("confirmPassword", e.target.value)}
                  className={errors.confirmPassword ? "border-red-500" : ""}
                />
                {errors.confirmPassword && <p className="text-red-500 text-sm mt-1">{errors.confirmPassword}</p>}
              </div>
            </div>

            <div>
              <Label htmlFor="phone">Phone Number *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => updateFormData("phone", e.target.value)}
                className={errors.phone ? "border-red-500" : ""}
                placeholder="(555) 123-4567"
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <School className="w-12 h-12 mx-auto text-sky-500 mb-2" />
              <h2 className="text-2xl font-bold text-gray-900">School Information</h2>
              <p className="text-gray-600">Tell us about your school and position</p>
            </div>

            <div>
              <Label htmlFor="schoolName">School Name *</Label>
              <Input
                id="schoolName"
                value={formData.schoolName}
                onChange={(e) => updateFormData("schoolName", e.target.value)}
                className={errors.schoolName ? "border-red-500" : ""}
              />
              {errors.schoolName && <p className="text-red-500 text-sm mt-1">{errors.schoolName}</p>}
            </div>

            <div>
              <Label htmlFor="schoolDistrict">School District *</Label>
              <Input
                id="schoolDistrict"
                value={formData.schoolDistrict}
                onChange={(e) => updateFormData("schoolDistrict", e.target.value)}
                className={errors.schoolDistrict ? "border-red-500" : ""}
              />
              {errors.schoolDistrict && <p className="text-red-500 text-sm mt-1">{errors.schoolDistrict}</p>}
            </div>

            <div>
              <Label htmlFor="schoolAddress">School Address *</Label>
              <Input
                id="schoolAddress"
                value={formData.schoolAddress}
                onChange={(e) => updateFormData("schoolAddress", e.target.value)}
                className={errors.schoolAddress ? "border-red-500" : ""}
              />
              {errors.schoolAddress && <p className="text-red-500 text-sm mt-1">{errors.schoolAddress}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="schoolCity">City *</Label>
                <Input
                  id="schoolCity"
                  value={formData.schoolCity}
                  onChange={(e) => updateFormData("schoolCity", e.target.value)}
                  className={errors.schoolCity ? "border-red-500" : ""}
                />
                {errors.schoolCity && <p className="text-red-500 text-sm mt-1">{errors.schoolCity}</p>}
              </div>

              <div>
                <Label htmlFor="schoolState">State *</Label>
                <Input
                  id="schoolState"
                  value={formData.schoolState}
                  onChange={(e) => updateFormData("schoolState", e.target.value)}
                  className={errors.schoolState ? "border-red-500" : ""}
                />
                {errors.schoolState && <p className="text-red-500 text-sm mt-1">{errors.schoolState}</p>}
              </div>

              <div>
                <Label htmlFor="schoolZip">ZIP Code *</Label>
                <Input
                  id="schoolZip"
                  value={formData.schoolZip}
                  onChange={(e) => updateFormData("schoolZip", e.target.value)}
                  className={errors.schoolZip ? "border-red-500" : ""}
                />
                {errors.schoolZip && <p className="text-red-500 text-sm mt-1">{errors.schoolZip}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="position">Position/Title *</Label>
                <Select value={formData.position} onValueChange={(value) => updateFormData("position", value)}>
                  <SelectTrigger className={errors.position ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select your position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="teacher">Teacher</SelectItem>
                    <SelectItem value="principal">Principal</SelectItem>
                    <SelectItem value="vice-principal">Vice Principal</SelectItem>
                    <SelectItem value="curriculum-coordinator">Curriculum Coordinator</SelectItem>
                    <SelectItem value="technology-coordinator">Technology Coordinator</SelectItem>
                    <SelectItem value="librarian">Librarian</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                {errors.position && <p className="text-red-500 text-sm mt-1">{errors.position}</p>}
              </div>

              <div>
                <Label htmlFor="yearsExperience">Years of Teaching Experience *</Label>
                <Select
                  value={formData.yearsExperience}
                  onValueChange={(value) => updateFormData("yearsExperience", value)}
                >
                  <SelectTrigger className={errors.yearsExperience ? "border-red-500" : ""}>
                    <SelectValue placeholder="Select experience" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0-1">0-1 years</SelectItem>
                    <SelectItem value="2-5">2-5 years</SelectItem>
                    <SelectItem value="6-10">6-10 years</SelectItem>
                    <SelectItem value="11-15">11-15 years</SelectItem>
                    <SelectItem value="16-20">16-20 years</SelectItem>
                    <SelectItem value="20+">20+ years</SelectItem>
                  </SelectContent>
                </Select>
                {errors.yearsExperience && <p className="text-red-500 text-sm mt-1">{errors.yearsExperience}</p>}
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <FileText className="w-12 h-12 mx-auto text-sky-500 mb-2" />
              <h2 className="text-2xl font-bold text-gray-900">Teaching Details</h2>
              <p className="text-gray-600">Tell us about your classroom and curriculum</p>
            </div>

            <div>
              <Label>Grades You Teach *</Label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                {grades.map((grade) => (
                  <div key={grade} className="flex items-center space-x-2">
                    <Checkbox
                      id={`grade_${grade}`}
                      checked={formData.gradesTaught.includes(grade)}
                      onCheckedChange={(checked) => {
                        const newGrades = checked
                          ? [...formData.gradesTaught, grade]
                          : formData.gradesTaught.filter((g) => g !== grade)
                        updateFormData("gradesTaught", newGrades)
                      }}
                    />
                    <Label htmlFor={`grade_${grade}`} className="text-sm">
                      {grade}
                    </Label>
                  </div>
                ))}
              </div>
              {errors.gradesTaught && <p className="text-red-500 text-sm mt-1">{errors.gradesTaught}</p>}
            </div>

            <div>
              <Label>Subjects You Teach *</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                {subjects.map((subject) => (
                  <div key={subject} className="flex items-center space-x-2">
                    <Checkbox
                      id={`subject_${subject}`}
                      checked={formData.subjectsTaught.includes(subject)}
                      onCheckedChange={(checked) => {
                        const newSubjects = checked
                          ? [...formData.subjectsTaught, subject]
                          : formData.subjectsTaught.filter((s) => s !== subject)
                        updateFormData("subjectsTaught", newSubjects)
                      }}
                    />
                    <Label htmlFor={`subject_${subject}`} className="text-sm">
                      {subject}
                    </Label>
                  </div>
                ))}
              </div>
              {errors.subjectsTaught && <p className="text-red-500 text-sm mt-1">{errors.subjectsTaught}</p>}
            </div>

            <div>
              <Label htmlFor="classSize">Average Class Size *</Label>
              <Select value={formData.classSize} onValueChange={(value) => updateFormData("classSize", value)}>
                <SelectTrigger className={errors.classSize ? "border-red-500" : ""}>
                  <SelectValue placeholder="Select class size" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1-10">1-10 students</SelectItem>
                  <SelectItem value="11-20">11-20 students</SelectItem>
                  <SelectItem value="21-30">21-30 students</SelectItem>
                  <SelectItem value="31-40">31-40 students</SelectItem>
                  <SelectItem value="40+">40+ students</SelectItem>
                </SelectContent>
              </Select>
              {errors.classSize && <p className="text-red-500 text-sm mt-1">{errors.classSize}</p>}
            </div>

            <div>
              <Label>Technology Available in Your Classroom</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {technologyOptions.map((tech) => (
                  <div key={tech} className="flex items-center space-x-2">
                    <Checkbox
                      id={`tech_${tech}`}
                      checked={formData.technologyAccess.includes(tech)}
                      onCheckedChange={(checked) => {
                        const newTech = checked
                          ? [...formData.technologyAccess, tech]
                          : formData.technologyAccess.filter((t) => t !== tech)
                        updateFormData("technologyAccess", newTech)
                      }}
                    />
                    <Label htmlFor={`tech_${tech}`} className="text-sm">
                      {tech}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="currentCurriculum">Current Curriculum/Programs Used</Label>
              <Textarea
                id="currentCurriculum"
                value={formData.currentCurriculum}
                onChange={(e) => updateFormData("currentCurriculum", e.target.value)}
                placeholder="Tell us about the curriculum or programs you currently use for STEM/Computer Science education"
                rows={3}
              />
            </div>

            <div>
              <Label htmlFor="goals">Goals for Using Kodable</Label>
              <Textarea
                id="goals"
                value={formData.goals}
                onChange={(e) => updateFormData("goals", e.target.value)}
                placeholder="What do you hope to achieve with your students using Kodable?"
                rows={3}
              />
            </div>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Check className="w-12 h-12 mx-auto text-sky-500 mb-2" />
              <h2 className="text-2xl font-bold text-gray-900">Verification</h2>
              <p className="text-gray-600">Help us verify your teaching credentials</p>
            </div>

            <div>
              <Label htmlFor="teacherLicense">Teacher License/Certification Number *</Label>
              <Input
                id="teacherLicense"
                value={formData.teacherLicense}
                onChange={(e) => updateFormData("teacherLicense", e.target.value)}
                className={errors.teacherLicense ? "border-red-500" : ""}
                placeholder="Enter your teaching license number"
              />
              {errors.teacherLicense && <p className="text-red-500 text-sm mt-1">{errors.teacherLicense}</p>}
            </div>

            <div>
              <Label htmlFor="schoolEmail">School Email Address *</Label>
              <Input
                id="schoolEmail"
                type="email"
                value={formData.schoolEmail}
                onChange={(e) => updateFormData("schoolEmail", e.target.value)}
                className={errors.schoolEmail ? "border-red-500" : ""}
                placeholder="your.name@schooldistrict.edu"
              />
              {errors.schoolEmail && <p className="text-red-500 text-sm mt-1">{errors.schoolEmail}</p>}
              <p className="text-gray-500 text-xs mt-1">We'll send a verification email to this address</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="principalName">Principal's Name *</Label>
                <Input
                  id="principalName"
                  value={formData.principalName}
                  onChange={(e) => updateFormData("principalName", e.target.value)}
                  className={errors.principalName ? "border-red-500" : ""}
                />
                {errors.principalName && <p className="text-red-500 text-sm mt-1">{errors.principalName}</p>}
              </div>

              <div>
                <Label htmlFor="principalEmail">Principal's Email *</Label>
                <Input
                  id="principalEmail"
                  type="email"
                  value={formData.principalEmail}
                  onChange={(e) => updateFormData("principalEmail", e.target.value)}
                  className={errors.principalEmail ? "border-red-500" : ""}
                />
                {errors.principalEmail && <p className="text-red-500 text-sm mt-1">{errors.principalEmail}</p>}
              </div>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-semibold text-blue-900 mb-2">Verification Process</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• We'll verify your teaching credentials with your state's education department</li>
                <li>• A verification email will be sent to your school email address</li>
                <li>• Your principal may be contacted to confirm your employment</li>
                <li>• This process typically takes 1-2 business days</li>
              </ul>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Check className="w-12 h-12 mx-auto text-sky-500 mb-2" />
              <h2 className="text-2xl font-bold text-gray-900">Final Steps</h2>
              <p className="text-gray-600">Review your preferences and complete registration</p>
            </div>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Communication Preferences</h3>
              <div className="space-y-3">
                {[
                  { id: "curriculum_updates", label: "Updates about new curriculum and features" },
                  { id: "professional_development", label: "Professional development opportunities" },
                  { id: "student_progress", label: "Tips for tracking student progress" },
                  { id: "community_events", label: "Teacher community events and webinars" },
                  { id: "research_insights", label: "Educational research and insights" },
                ].map((pref) => (
                  <div key={pref.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={pref.id}
                      checked={formData.communicationPreferences.includes(pref.id)}
                      onCheckedChange={(checked) => {
                        const newPrefs = checked
                          ? [...formData.communicationPreferences, pref.id]
                          : formData.communicationPreferences.filter((p) => p !== pref.id)
                        updateFormData("communicationPreferences", newPrefs)
                      }}
                    />
                    <Label htmlFor={pref.id}>{pref.label}</Label>
                  </div>
                ))}
              </div>
            </Card>

            <div className="space-y-4">
              <div className="flex items-start space-x-2">
                <Checkbox
                  id="termsAccepted"
                  checked={formData.termsAccepted}
                  onCheckedChange={(checked) => updateFormData("termsAccepted", checked)}
                  className={errors.termsAccepted ? "border-red-500" : ""}
                />
                <Label htmlFor="termsAccepted" className="text-sm">
                  I agree to the{" "}
                  <Link href="/terms" className="text-blue-600 hover:underline">
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link href="/educator-terms" className="text-blue-600 hover:underline">
                    Educator Agreement
                  </Link>{" "}
                  *
                </Label>
              </div>
              {errors.termsAccepted && <p className="text-red-500 text-sm">{errors.termsAccepted}</p>}

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="privacyAccepted"
                  checked={formData.privacyAccepted}
                  onCheckedChange={(checked) => updateFormData("privacyAccepted", checked)}
                  className={errors.privacyAccepted ? "border-red-500" : ""}
                />
                <Label htmlFor="privacyAccepted" className="text-sm">
                  I agree to the{" "}
                  <Link href="/privacy" className="text-blue-600 hover:underline">
                    Privacy Policy
                  </Link>{" "}
                  and{" "}
                  <Link href="/student-privacy" className="text-blue-600 hover:underline">
                    Student Privacy Policy
                  </Link>{" "}
                  *
                </Label>
              </div>
              {errors.privacyAccepted && <p className="text-red-500 text-sm">{errors.privacyAccepted}</p>}

              <div className="flex items-start space-x-2">
                <Checkbox
                  id="marketingConsent"
                  checked={formData.marketingConsent}
                  onCheckedChange={(checked) => updateFormData("marketingConsent", checked)}
                />
                <Label htmlFor="marketingConsent" className="text-sm">
                  I would like to receive marketing communications about new educational resources and special offers
                </Label>
              </div>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
   

      <div className="px-4 py-8 md:px-6">
        <div className="mx-auto max-w-2xl">
          {/* Progress Bar */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-600">
                Step {currentStep} of {totalSteps}
              </span>
              <span className="text-sm font-medium text-gray-600">{Math.round((currentStep / totalSteps) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-sky-500 to-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              ></div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="text-2xl font-black text-gray-900">Kodable</div>
                  <div className="text-2xl font-light text-sky-500">Education</div>
                </div>
                Teacher Registration
              </CardTitle>
            </CardHeader>
            <CardContent>
              {renderStepContent()}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8">
                <Button
                  variant="outline"
                  onClick={prevStep}
                  disabled={currentStep === 1}
                  className="flex items-center space-x-2 bg-transparent"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Previous</span>
                </Button>

                {currentStep < totalSteps ? (
                  <Button
                    onClick={nextStep}
                    className="bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 flex items-center space-x-2"
                  >
                    <span>Next</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    className="bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 flex items-center space-x-2"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Creating Account...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>Create Account</span>
                      </>
                    )}
                  </Button>
                )}
              </div>

              {/* Login Link */}
              <div className="text-center mt-6 pt-6 border-t border-gray-200">
                <p className="text-gray-600">
                  Already have an account?{" "}
                  <Link href="/login" className="text-blue-600 hover:underline font-medium">
                    Sign in here
                  </Link>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
     
    </div>
  )
}
