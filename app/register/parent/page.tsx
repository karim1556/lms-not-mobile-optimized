"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import Link from "next/link"
import { useState } from "react"
import { ArrowLeft, ArrowRight, Check, User, MapPin, Users } from "lucide-react"

interface FormData {
  // Personal Information
  firstName: string
  lastName: string
  email: string
  confirmEmail: string
  password: string
  confirmPassword: string
  phone: string

  // Address Information
  address: string
  city: string
  state: string
  zipCode: string
  country: string

  // Children Information
  children: Array<{
    name: string
    age: string
    grade: string
    interests: string[]
  }>

  // Preferences
  communicationPreferences: string[]
  marketingConsent: boolean
  termsAccepted: boolean
  privacyAccepted: boolean
}

const initialFormData: FormData = {
  firstName: "",
  lastName: "",
  email: "",
  confirmEmail: "",
  password: "",
  confirmPassword: "",
  phone: "",
  address: "",
  city: "",
  state: "",
  zipCode: "",
  country: "United States",
  children: [{ name: "", age: "", grade: "", interests: [] }],
  communicationPreferences: [],
  marketingConsent: false,
  termsAccepted: false,
  privacyAccepted: false,
}

const interests = [
  "Coding",
  "Robotics",
  "Game Design",
  "Mathematics",
  "Science",
  "Art & Design",
  "Music",
  "Sports",
  "Reading",
  "Problem Solving",
]

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
]

export default function ParentRegistration() {
  const [currentStep, setCurrentStep] = useState(1)
  const [formData, setFormData] = useState<FormData>(initialFormData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const totalSteps = 4

  const updateFormData = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: "" }))
    }
  }

  const addChild = () => {
    setFormData((prev) => ({
      ...prev,
      children: [...prev.children, { name: "", age: "", grade: "", interests: [] }],
    }))
  }

  const removeChild = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      children: prev.children.filter((_, i) => i !== index),
    }))
  }

  const updateChild = (index: number, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      children: prev.children.map((child, i) => (i === index ? { ...child, [field]: value } : child)),
    }))
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
      if (!formData.address.trim()) newErrors.address = "Address is required"
      if (!formData.city.trim()) newErrors.city = "City is required"
      if (!formData.state.trim()) newErrors.state = "State is required"
      if (!formData.zipCode.trim()) newErrors.zipCode = "ZIP code is required"
    }

    if (step === 3) {
      formData.children.forEach((child, index) => {
        if (!child.name.trim()) newErrors[`child_${index}_name`] = "Child's name is required"
        if (!child.age) newErrors[`child_${index}_age`] = "Age is required"
        if (!child.grade) newErrors[`child_${index}_grade`] = "Grade is required"
      })
    }

    if (step === 4) {
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
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 2000))
      // Registration data processed
      // Redirect to success page or dashboard
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
              <User className="w-12 h-12 mx-auto text-pink-500 mb-2" />
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
              <Label htmlFor="email">Email Address *</Label>
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
                <p className="text-gray-500 text-xs mt-1">Must be at least 8 characters</p>
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
              <MapPin className="w-12 h-12 mx-auto text-pink-500 mb-2" />
              <h2 className="text-2xl font-bold text-gray-900">Address Information</h2>
              <p className="text-gray-600">Where should we send important updates?</p>
            </div>

            <div>
              <Label htmlFor="address">Street Address *</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => updateFormData("address", e.target.value)}
                className={errors.address ? "border-red-500" : ""}
                placeholder="123 Main Street"
              />
              {errors.address && <p className="text-red-500 text-sm mt-1">{errors.address}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => updateFormData("city", e.target.value)}
                  className={errors.city ? "border-red-500" : ""}
                />
                {errors.city && <p className="text-red-500 text-sm mt-1">{errors.city}</p>}
              </div>

              <div>
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => updateFormData("state", e.target.value)}
                  className={errors.state ? "border-red-500" : ""}
                />
                {errors.state && <p className="text-red-500 text-sm mt-1">{errors.state}</p>}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="zipCode">ZIP Code *</Label>
                <Input
                  id="zipCode"
                  value={formData.zipCode}
                  onChange={(e) => updateFormData("zipCode", e.target.value)}
                  className={errors.zipCode ? "border-red-500" : ""}
                  placeholder="12345"
                />
                {errors.zipCode && <p className="text-red-500 text-sm mt-1">{errors.zipCode}</p>}
              </div>

              <div>
                <Label htmlFor="country">Country</Label>
                <Select value={formData.country} onValueChange={(value) => updateFormData("country", value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="United States">United States</SelectItem>
                    <SelectItem value="Canada">Canada</SelectItem>
                    <SelectItem value="United Kingdom">United Kingdom</SelectItem>
                    <SelectItem value="Australia">Australia</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Users className="w-12 h-12 mx-auto text-pink-500 mb-2" />
              <h2 className="text-2xl font-bold text-gray-900">Children Information</h2>
              <p className="text-gray-600">Tell us about your children who will be using Ai</p>
            </div>

            {formData.children.map((child, index) => (
              <Card key={index} className="p-4">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold">Child {index + 1}</h3>
                  {formData.children.length > 1 && (
                    <Button variant="outline" size="sm" onClick={() => removeChild(index)}>
                      Remove
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <Label htmlFor={`child_${index}_name`}>Child's Name *</Label>
                    <Input
                      id={`child_${index}_name`}
                      value={child.name}
                      onChange={(e) => updateChild(index, "name", e.target.value)}
                      className={errors[`child_${index}_name`] ? "border-red-500" : ""}
                    />
                    {errors[`child_${index}_name`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`child_${index}_name`]}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor={`child_${index}_age`}>Age *</Label>
                    <Select value={child.age} onValueChange={(value) => updateChild(index, "age", value)}>
                      <SelectTrigger className={errors[`child_${index}_age`] ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select age" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 14 }, (_, i) => i + 4).map((age) => (
                          <SelectItem key={age} value={age.toString()}>
                            {age} years old
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors[`child_${index}_age`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`child_${index}_age`]}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor={`child_${index}_grade`}>Grade *</Label>
                    <Select value={child.grade} onValueChange={(value) => updateChild(index, "grade", value)}>
                      <SelectTrigger className={errors[`child_${index}_grade`] ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select grade" />
                      </SelectTrigger>
                      <SelectContent>
                        {grades.map((grade) => (
                          <SelectItem key={grade} value={grade}>
                            {grade}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {errors[`child_${index}_grade`] && (
                      <p className="text-red-500 text-sm mt-1">{errors[`child_${index}_grade`]}</p>
                    )}
                  </div>
                </div>

                <div>
                  <Label>Interests (Select all that apply)</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
                    {interests.map((interest) => (
                      <div key={interest} className="flex items-center space-x-2">
                        <Checkbox
                          id={`child_${index}_interest_${interest}`}
                          checked={child.interests.includes(interest)}
                          onCheckedChange={(checked) => {
                            const newInterests = checked
                              ? [...child.interests, interest]
                              : child.interests.filter((i) => i !== interest)
                            updateChild(index, "interests", newInterests)
                          }}
                        />
                        <Label htmlFor={`child_${index}_interest_${interest}`} className="text-sm">
                          {interest}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </Card>
            ))}

            <Button variant="outline" onClick={addChild} className="w-full bg-transparent">
              Add Another Child
            </Button>
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-6">
              <Check className="w-12 h-12 mx-auto text-pink-500 mb-2" />
              <h2 className="text-2xl font-bold text-gray-900">Final Steps</h2>
              <p className="text-gray-600">Review your preferences and complete registration</p>
            </div>

            <Card className="p-4">
              <h3 className="font-semibold mb-4">Communication Preferences</h3>
              <div className="space-y-3">
                {[
                  { id: "email_updates", label: "Email updates about my child's progress" },
                  { id: "newsletter", label: "Monthly newsletter with tips and resources" },
                  { id: "course_recommendations", label: "Personalized course recommendations" },
                  { id: "event_notifications", label: "Notifications about events and webinars" },
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
                  I would like to receive marketing communications about new courses and special offers
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
                className="bg-gradient-to-r from-pink-500 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / totalSteps) * 100}%` }}
              ></div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-center">
                <div className="flex items-center justify-center space-x-2 mb-2">
                  <div className="text-2xl font-black text-gray-900">Ai</div>
                  <div className="text-2xl font-light text-sky-500">Skool</div>
                </div>
                Parent Registration
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
                    className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 flex items-center space-x-2"
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
