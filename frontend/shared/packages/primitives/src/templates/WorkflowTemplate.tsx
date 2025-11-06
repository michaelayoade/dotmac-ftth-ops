"use client";

import React, { useState, useCallback } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CheckIcon } from "@heroicons/react/24/outline";

interface WorkflowStep {
  id: string;
  title: string;
  description?: string;
  component: React.ComponentType<any>;
  validation?: () => boolean | Promise<boolean>;
  required?: boolean;
}

interface WorkflowTemplateProps {
  steps: WorkflowStep[];
  onComplete: (data: Record<string, any>) => void;
  onCancel?: () => void;
  title: string;
  subtitle?: string;
  showProgress?: boolean;
  className?: string;
}

export const WorkflowTemplate: React.FC<WorkflowTemplateProps> = ({
  steps,
  onComplete,
  onCancel,
  title,
  subtitle,
  showProgress = true,
  className = "",
}) => {
  if (steps.length === 0) {
    return null;
  }

  const [currentStep, setCurrentStep] = useState(0);
  const [stepData, setStepData] = useState<Record<string, any>>({});
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const updateStepData = useCallback((stepId: string, data: any) => {
    setStepData((prev) => ({ ...prev, [stepId]: data }));
  }, []);

  const canProceed = useCallback(async () => {
    const step = steps[currentStep];
    if (!step) {
      return false;
    }
    if (step.validation) {
      return await step.validation();
    }
    return true;
  }, [steps, currentStep]);

  const handleNext = useCallback(async () => {
    if (await canProceed()) {
      setCompletedSteps((prev) => new Set([...prev, currentStep]));

      if (currentStep < steps.length - 1) {
        setCurrentStep((prev) => prev + 1);
      } else {
        onComplete(stepData);
      }
    }
  }, [currentStep, steps.length, stepData, onComplete, canProceed]);

  const handlePrevious = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
    }
  }, [currentStep]);

  const handleStepClick = useCallback(
    (stepIndex: number) => {
      if (stepIndex <= currentStep || completedSteps.has(stepIndex)) {
        setCurrentStep(stepIndex);
      }
    },
    [currentStep, completedSteps],
  );

  const currentStepData = steps[currentStep];
  if (!currentStepData) {
    return null;
  }
  const StepComponent = currentStepData.component;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <div className={`workflow-template ${className}`}>
      <div className="workflow-header bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
            {subtitle && <p className="text-gray-600 mt-1">{subtitle}</p>}
          </div>
          {onCancel && (
            <button onClick={onCancel} className="text-gray-500 hover:text-gray-700 px-4 py-2">
              Cancel
            </button>
          )}
        </div>

        {showProgress && (
          <div className="mt-6">
            <div className="flex items-center">
              {steps.map((step, index) => (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => handleStepClick(index)}
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium
                      transition-all duration-200
                      ${
                        completedSteps.has(index)
                          ? "bg-green-500 text-white hover:bg-green-600"
                          : index === currentStep
                            ? "bg-blue-500 text-white"
                            : index < currentStep
                              ? "bg-gray-300 text-gray-700 hover:bg-gray-400"
                              : "bg-gray-100 text-gray-400 cursor-not-allowed"
                      }
                    `}
                    disabled={index > currentStep && !completedSteps.has(index)}
                  >
                    {completedSteps.has(index) ? <CheckIcon className="w-5 h-5" /> : index + 1}
                  </button>
                  {index < steps.length - 1 && (
                    <div
                      className={`
                        w-12 h-0.5 mx-2
                        ${
                          completedSteps.has(index) || index < currentStep
                            ? "bg-green-300"
                            : "bg-gray-200"
                        }
                      `}
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-between text-xs text-gray-500">
              {steps.map((step, index) => (
                <div
                  key={step.id}
                  className={`
                    flex-1 text-center
                    ${index === currentStep ? "font-medium text-blue-600" : ""}
                  `}
                >
                  {step.title}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="workflow-content flex-1 bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900">{currentStepData.title}</h2>
              {currentStepData.description && (
                <p className="text-gray-600 mt-2">{currentStepData.description}</p>
              )}
            </div>

            <div className="step-component">
              <StepComponent
                data={stepData[currentStepData.id] || {}}
                onChange={(data: any) => updateStepData(currentStepData.id, data)}
                onNext={handleNext}
                onPrevious={handlePrevious}
                isFirst={currentStep === 0}
                isLast={isLastStep}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="workflow-footer bg-white border-t border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="
              flex items-center px-4 py-2 text-sm font-medium text-gray-700
              bg-white border border-gray-300 rounded-md shadow-sm
              hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500
              disabled:opacity-50 disabled:cursor-not-allowed
            "
          >
            <ChevronLeftIcon className="w-4 h-4 mr-2" />
            Previous
          </button>

          <div className="flex items-center space-x-3">
            <span className="text-sm text-gray-500">
              Step {currentStep + 1} of {steps.length}
            </span>
            <button
              onClick={handleNext}
              className="
                flex items-center px-6 py-2 text-sm font-medium text-white
                bg-blue-600 border border-transparent rounded-md shadow-sm
                hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500
              "
            >
              {isLastStep ? "Complete" : "Next"}
              {!isLastStep && <ChevronRightIcon className="w-4 h-4 ml-2" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export interface WorkflowStepProps {
  data: any;
  onChange: (data: any) => void;
  onNext?: () => void;
  onPrevious?: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}
