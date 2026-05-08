'use client'
import { createContext } from 'react'

export interface OnboardingCtx { complete: boolean; step: string }
export const OnboardingContext = createContext<OnboardingCtx>({ complete: true, step: 'complete' })
