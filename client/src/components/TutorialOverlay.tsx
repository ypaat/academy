import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { ChevronRight, ChevronLeft } from 'lucide-react';

export interface TutorialStep {
  title: string;
  content: string;
  highlightSelector?: string;
  characterMood?: 'happy' | 'thinking' | 'excited';
}

interface TutorialOverlayProps {
  steps: TutorialStep[];
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onComplete: () => void;
  visible: boolean;
}

const CHARACTER_EXPRESSIONS = {
  happy: '😊',
  thinking: '🤔',
  excited: '🎉'
};

export function TutorialOverlay({
  steps,
  currentStep,
  onNext,
  onPrev,
  onComplete,
  visible
}: TutorialOverlayProps) {
  if (!visible) return null;

  const currentTutorialStep = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;
  const isLastStep = currentStep === steps.length - 1;

  return (
    <AnimatePresence>
      {visible && (
        <div className="fixed inset-0 bg-black/50 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
            className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-xl"
          >
            <Card className="p-6 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="text-6xl">
                  {CHARACTER_EXPRESSIONS[currentTutorialStep.characterMood || 'happy']}
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-xl font-semibold">
                    {currentTutorialStep.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {currentTutorialStep.content}
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                <Progress value={progress} className="h-2" />

                <div className="flex justify-between items-center">
                  <Button
                    variant="ghost"
                    onClick={onPrev}
                    disabled={currentStep === 0}
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>

                  <span className="text-sm text-muted-foreground">
                    Step {currentStep + 1} of {steps.length}
                  </span>

                  <Button
                    onClick={isLastStep ? onComplete : onNext}
                  >
                    {isLastStep ? (
                      "Complete Tutorial"
                    ) : (
                      <>
                        Next
                        <ChevronRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </Card>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}