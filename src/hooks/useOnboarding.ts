'use client'
import { useContext } from 'react'
import { OnboardingContext } from '@/contexts/OnboardingContext'

export function useOnboarding() { return useContext(OnboardingContext) }
