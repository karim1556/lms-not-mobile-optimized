"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"

interface Step {
  id: string
  title: string
  icon?: React.ComponentType<any>
}

interface MultiStepFormProps {
  steps: Step[]
  children: React.ReactNode[]
  onComplete?: (data: any) => void
  className?: string
  onBeforeNext?: (currentStep: number) => boolean | Promise<boolean>
}

export function MultiStepForm({ steps, children, onComplete, className, onBeforeNext }: MultiStepFormProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [formData, setFormData] = useState({})

  const progress = ((currentStep + 1) / steps.length) * 100

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      // allow caller to veto advancing to next step
      const proceed = onBeforeNext ? onBeforeNext(currentStep) : true
      if (proceed instanceof Promise) {
        proceed.then((ok) => {
          if (ok) setCurrentStep(currentStep + 1)
        })
      } else {
        if (proceed) setCurrentStep(currentStep + 1)
      }
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = () => {
    if (onComplete) {
      onComplete(formData)
    }
  }

  const handleStepClick = (stepIndex: number) => {
    setCurrentStep(stepIndex)
  }

  return (
    <div className={className}>
      {/* Progress Bar */}
      <div className="mb-8">
        <Progress value={progress} className="mb-4" />
        <div className="flex justify-between text-sm text-gray-600">
          <span>
            Step {currentStep + 1} of {steps.length}
          </span>
          <span>{Math.round(progress)}% Complete</span>
        </div>
      </div>

      {/* Step Navigation */}
      <div className="flex flex-wrap gap-2 mb-8">
        {steps.map((step, index) => {
          const Icon = step.icon
          return (
            <button
              key={step.id}
              onClick={() => handleStepClick(index)}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors
                ${
                  index === currentStep
                    ? "bg-blue-600 text-white border-blue-600"
                    : index < currentStep
                      ? "bg-green-100 text-green-800 border-green-300"
                      : "bg-gray-100 text-gray-600 border-gray-300 hover:bg-gray-200"
                }
              `}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span className="text-sm font-medium">{step.title}</span>
            </button>
          )
        })}
      </div>

      {/* Current Step Content */}
      <div className="mb-8">{children[currentStep]}</div>

      {/* Navigation Buttons */}
      <div className="flex justify-between">
        <Button type="button" variant="outline" onClick={handlePrevious} disabled={currentStep === 0}>
          Previous
        </Button>

        <div className="flex gap-2">
          {currentStep === steps.length - 1 ? (
            <Button onClick={handleComplete} className="bg-green-600 hover:bg-green-700">
              Complete
            </Button>
          ) : (
            <Button onClick={handleNext} className="bg-blue-600 hover:bg-blue-700">
              Next
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
