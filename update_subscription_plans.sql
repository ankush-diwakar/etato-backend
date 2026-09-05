-- ==============================================================================
-- SQL Migration Script for phpMyAdmin / MySQL
-- Table: subscription_plans
-- Description: Adds dynamic visual metadata columns and populates existing plans.
-- ==============================================================================

-- Step 1: Add metadata & design columns to subscription_plans table
ALTER TABLE `subscription_plans`
  ADD COLUMN `badge` VARCHAR(191) NULL AFTER `perBowlPrice`,
  ADD COLUMN `cta` VARCHAR(191) NULL AFTER `badge`,
  ADD COLUMN `icon` VARCHAR(191) NULL AFTER `cta`,
  ADD COLUMN `best` TEXT NULL AFTER `icon`,
  ADD COLUMN `bonus` TEXT NULL AFTER `best`,
  ADD COLUMN `includes` JSON NULL AFTER `bonus`,
  ADD COLUMN `theme` TEXT NULL AFTER `includes`,
  ADD COLUMN `titleColor` VARCHAR(191) NULL AFTER `theme`,
  ADD COLUMN `iconColor` VARCHAR(191) NULL AFTER `titleColor`,
  ADD COLUMN `dividerColor` VARCHAR(191) NULL AFTER `iconColor`;

-- Step 2: Populate existing subscription plans with frontend metadata, badges, pointers, and styling

-- 1. Trial Plan
UPDATE `subscription_plans`
SET 
  `badge` = 'New User',
  `cta` = 'Choose Trial Plan',
  `icon` = 'Sprout',
  `best` = 'First-time users who want to try out our salads.',
  `bonus` = NULL,
  `includes` = '["Daily rotating bowl menu", "Perfect to test our taste & quality", "No skipping meals"]',
  `theme` = 'bg-white text-[#0A472E] border border-[#d0ddd4] hover:border-[#0A472E] hover:shadow-xl transition-all duration-300',
  `titleColor` = 'text-[#0A472E]',
  `iconColor` = 'text-[#0A472E]',
  `dividerColor` = 'border-[#0A472E]/10',
  `updatedAt` = NOW(3)
WHERE `id` = 'trial';

-- 2. Weekly Plan
UPDATE `subscription_plans`
SET 
  `badge` = 'Popular',
  `cta` = 'Choose Weekly Plan',
  `icon` = 'Flame',
  `best` = 'Working professionals, gym-goers and healthy eating beginners.',
  `bonus` = NULL,
  `includes` = '["Daily rotating bowl menu", "Paneer & Pasta premium bowls included", "Skip 1 meal and redeem next Monday"]',
  `theme` = 'bg-[#0A472E] text-white border border-[#C9D909] hover:shadow-xl transition-all duration-300',
  `titleColor` = 'text-white',
  `iconColor` = 'text-[#C9D909]',
  `dividerColor` = 'border-white/10',
  `updatedAt` = NOW(3)
WHERE `id` = 'weekly';

-- 3. Premium Monthly Membership Plan
UPDATE `subscription_plans`
SET 
  `badge` = 'Premium Membership',
  `cta` = 'Choose Monthly Plan',
  `icon` = 'Crown',
  `best` = 'Fitness-focused customers and long-term healthy eating.',
  `bonus` = '🎁 First Month Bonus: Get 27 bowls for the price of 26 (1 FREE ETATO Protein Bowl worth ₹249)',
  `includes` = '["Daily rotating bowl menu", "Premium bowls included", "Skip up to 3 meals/month", "Redeem meals next month (Mon/Tue/Wed)"]',
  `theme` = 'bg-white text-[#0A472E] border border-[#d0ddd4] hover:border-[#C9D909] hover:shadow-xl transition-all duration-300',
  `titleColor` = 'text-[#0A472E]',
  `iconColor` = 'text-[#0A472E]',
  `dividerColor` = 'border-[#0A472E]/10',
  `updatedAt` = NOW(3)
WHERE `id` = 'monthly';

-- 4. Monthly Office Plan
UPDATE `subscription_plans`
SET 
  `badge` = 'Office Special',
  `cta` = 'Choose Office Plan',
  `icon` = 'Briefcase',
  `best` = 'Fuel Your Work Week',
  `bonus` = '💼 Mon to Fri – 20 high protein salads at 4499 Rs (Save 500rs)',
  `includes` = '["Daily rotating bowl menu", "Monday–Friday (20 Bowls)", "Skip up to 2 meals/month", "Redeem meals next month (1st/2nd)"]',
  `theme` = 'bg-white text-[#0A472E] border border-[#d0ddd4] hover:border-[#C9D909] hover:shadow-xl transition-all duration-300',
  `titleColor` = 'text-[#0A472E]',
  `iconColor` = 'text-[#0A472E]',
  `dividerColor` = 'border-[#0A472E]/10',
  `updatedAt` = NOW(3)
WHERE `id` = '70c0eb28-b444-4601-9196-69a519f2435f';
