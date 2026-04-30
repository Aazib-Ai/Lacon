/**
 * useSkills — React hook for managing writer skills
 *
 * Wraps window.electron.skill.* IPC calls and provides
 * reactive state for the skills library UI.
 */

import { useCallback, useEffect, useState } from 'react'

import type {
  WriterSkill,
  SkillListItem,
  SkillSource,
  ComposedSkill,
} from '../../shared/writer-types'

export interface UseSkillsReturn {
  /** All available skills (built-in + project) */
  skills: SkillListItem[]
  /** Currently active skill IDs in the writer session */
  activeSkillIds: string[]
  /** Full skill data for the detail view */
  selectedSkill: WriterSkill | null
  /** Result of composing active skills */
  composedSkill: ComposedSkill | null
  /** Loading state */
  loading: boolean
  /** Error message */
  error: string | null

  // ── Actions ──
  /** Load/refresh the skills list */
  loadSkills: () => Promise<void>
  /** Select a skill to view its full details */
  selectSkill: (id: string | null) => Promise<void>
  /** Toggle a skill's active state */
  toggleSkill: (id: string) => void
  /** Set specific skill IDs as active */
  activateSkills: (ids: string[]) => void
  /** Deactivate a single skill */
  deactivateSkill: (id: string) => void
  /** Create a new user skill */
  createSkill: (params: {
    name: string
    description: string
    content: string
    tags: string[]
    rubric?: string
  }) => Promise<WriterSkill | null>
  /** Compose active skills into a merged prompt */
  composeActiveSkills: () => Promise<void>
  /** Filter skills by source */
  filterBySource: (source: SkillSource | 'all') => void
  /** Search skills by query */
  searchSkills: (query: string) => void
  /** Current source filter */
  sourceFilter: SkillSource | 'all'
  /** Current search query */
  searchQuery: string
  /** Filtered skills list (after search + source filter) */
  filteredSkills: SkillListItem[]
}

export function useSkills(documentId?: string): UseSkillsReturn {
  const [skills, setSkills] = useState<SkillListItem[]>([])
  const [activeSkillIds, setActiveSkillIds] = useState<string[]>([])
  const [selectedSkill, setSelectedSkill] = useState<WriterSkill | null>(null)
  const [composedSkill, setComposedSkill] = useState<ComposedSkill | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sourceFilter, setSourceFilter] = useState<SkillSource | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')

  // ── Load all skills ──
  const loadSkills = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await window.electron?.skill?.list()
      if (result?.success && Array.isArray(result.data)) {
        setSkills(result.data)
      } else if (Array.isArray(result)) {
        setSkills(result)
      } else {
        setSkills([])
      }
    } catch (err) {
      console.error('[useSkills] Failed to load skills:', err)
      setError('Failed to load skills')
    } finally {
      setLoading(false)
    }
  }, [])

  // ── Load active skill IDs from session ──
  const loadActiveSkills = useCallback(async () => {
    if (!documentId) return
    try {
      const result = await window.electron?.workspace?.getSession(documentId)
      if (result?.success && result.data?.activeSkillIds) {
        setActiveSkillIds(result.data.activeSkillIds)
      } else if (result?.activeSkillIds) {
        setActiveSkillIds(result.activeSkillIds)
      }
    } catch {
      // Non-critical — session may not exist yet
    }
  }, [documentId])

  // Initial load
  useEffect(() => {
    loadSkills()
    loadActiveSkills()
  }, [loadSkills, loadActiveSkills])

  // ── Select a skill for detail view ──
  const selectSkill = useCallback(
    async (id: string | null) => {
      if (!id) {
        setSelectedSkill(null)
        return
      }
      setLoading(true)
      setError(null)
      try {
        const result = await window.electron?.skill?.get(id, documentId)
        if (result?.success && result.data) {
          setSelectedSkill(result.data)
        } else if (result && result.id) {
          setSelectedSkill(result)
        } else {
          setError('Skill not found')
        }
      } catch (err) {
        console.error('[useSkills] Failed to get skill:', err)
        setError('Failed to load skill details')
      } finally {
        setLoading(false)
      }
    },
    [documentId],
  )

  // ── Persist active skills to session ──
  const persistActiveSkills = useCallback(
    async (ids: string[]) => {
      if (!documentId) return
      try {
        await window.electron?.writerLoop?.updateConfig(documentId, {
          activeSkillIds: ids,
        })
      } catch (err) {
        console.error('[useSkills] Failed to persist active skills:', err)
      }
    },
    [documentId],
  )

  // ── Toggle a skill ──
  const toggleSkill = useCallback(
    (id: string) => {
      setActiveSkillIds(prev => {
        let next: string[]
        if (prev.includes(id)) {
          next = prev.filter(s => s !== id)
        } else {
          if (prev.length >= 3) {
            setError('Maximum 3 skills can be active at once')
            return prev
          }
          next = [...prev, id]
        }
        setError(null)
        persistActiveSkills(next)
        return next
      })
    },
    [persistActiveSkills],
  )

  // ── Activate specific skills ──
  const activateSkills = useCallback(
    (ids: string[]) => {
      const clamped = ids.slice(0, 3)
      setActiveSkillIds(clamped)
      persistActiveSkills(clamped)
    },
    [persistActiveSkills],
  )

  // ── Deactivate a single skill ──
  const deactivateSkill = useCallback(
    (id: string) => {
      setActiveSkillIds(prev => {
        const next = prev.filter(s => s !== id)
        persistActiveSkills(next)
        return next
      })
    },
    [persistActiveSkills],
  )

  // ── Create a user skill ──
  const createSkill = useCallback(
    async (params: {
      name: string
      description: string
      content: string
      tags: string[]
      rubric?: string
    }): Promise<WriterSkill | null> => {
      setLoading(true)
      setError(null)
      try {
        const result = await window.electron?.skill?.create(params)
        if (result?.success && result.data) {
          await loadSkills() // refresh list
          return result.data
        } else if (result && result.id) {
          await loadSkills()
          return result
        }
        setError('Failed to create skill')
        return null
      } catch (err) {
        console.error('[useSkills] Failed to create skill:', err)
        setError('Failed to create skill')
        return null
      } finally {
        setLoading(false)
      }
    },
    [loadSkills],
  )

  // ── Compose active skills ──
  const composeActiveSkills = useCallback(async () => {
    if (activeSkillIds.length === 0) {
      setComposedSkill(null)
      return
    }
    try {
      const result = await window.electron?.skill?.compose(activeSkillIds, documentId)
      if (result?.success && result.data) {
        setComposedSkill(result.data)
      } else if (result && result.composedPrompt) {
        setComposedSkill(result)
      }
    } catch (err) {
      console.error('[useSkills] Failed to compose skills:', err)
    }
  }, [activeSkillIds, documentId])

  // Auto-compose when active skills change
  useEffect(() => {
    composeActiveSkills()
  }, [composeActiveSkills])

  // ── Filter & search ──
  const filterBySource = useCallback((source: SkillSource | 'all') => {
    setSourceFilter(source)
  }, [])

  const searchSkillsFn = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  const filteredSkills = skills.filter(skill => {
    // Source filter
    if (sourceFilter !== 'all' && skill.source !== sourceFilter) return false
    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      return (
        skill.name.toLowerCase().includes(q) ||
        skill.description.toLowerCase().includes(q) ||
        skill.tags.some(t => t.toLowerCase().includes(q))
      )
    }
    return true
  })

  return {
    skills,
    activeSkillIds,
    selectedSkill,
    composedSkill,
    loading,
    error,
    loadSkills,
    selectSkill,
    toggleSkill,
    activateSkills,
    deactivateSkill,
    createSkill,
    composeActiveSkills,
    filterBySource,
    searchSkills: searchSkillsFn,
    sourceFilter,
    searchQuery,
    filteredSkills,
  }
}
