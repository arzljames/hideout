import { Hash, Link as LinkIcon, Settings, Users, type LucideIcon } from 'lucide-react'
import { z } from 'zod'

export const SETTINGS_SECTION_IDS = ['overview', 'members', 'invites', 'channels'] as const

export type SettingsSection = (typeof SETTINGS_SECTION_IDS)[number]

export const settingsSectionSchema = z.enum(SETTINGS_SECTION_IDS)

/**
 * Search params for /rooms/$roomId/settings. `section` is optional in links (defaults to
 * overview) and an unknown value falls back to overview instead of erroring.
 */
export const settingsSearchSchema = z.object({
  section: settingsSectionSchema.default('overview').catch('overview'),
})

export interface SettingsSectionInfo {
  id: SettingsSection
  label: string
  icon: LucideIcon
}

export const SETTINGS_SECTIONS: SettingsSectionInfo[] = [
  { id: 'overview', label: 'Overview', icon: Settings },
  { id: 'members', label: 'Members', icon: Users },
  { id: 'invites', label: 'Invites', icon: LinkIcon },
  { id: 'channels', label: 'Channels', icon: Hash },
]
