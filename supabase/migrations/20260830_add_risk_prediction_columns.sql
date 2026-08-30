-- Migration: Add adjournment_risk_score and predicted_duration_minutes to cases table
-- These columns support the AI Predictive Intelligence panel in the case registration form.

ALTER TABLE public.cases
  ADD COLUMN IF NOT EXISTS adjournment_risk_score integer,
  ADD COLUMN IF NOT EXISTS predicted_duration_minutes integer;
