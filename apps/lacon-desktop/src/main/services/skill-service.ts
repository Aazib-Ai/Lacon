/**
 * Skill Service — Phase 1
 *
 * Manages the skill lifecycle:
 * - Loading built-in skills from resources/skills/
 * - Loading user/agent skills from .lacon/skills/
 * - Creating new skills
 * - Deterministic composition of up to 3 skills
 * - Skill research (stub for Phase 5)
 */

import { app } from 'electron'
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'fs'
import { join, basename } from 'path'

import type {
  WriterSkill,
  SkillListItem,
  SkillSource,
  ComposedSkill,
} from '../../shared/writer-types'
import { getProjectWorkspaceService } from './project-workspace-service'

// ── Built-in skills directory ──
// In production, built-in skills ship inside the app's resources folder.
// During development, they live at apps/lacon-desktop/resources/skills/
function getBuiltInSkillsPath(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'skills')
  }
  // Development: resolve relative to the app root
  return join(__dirname, '../../resources/skills')
}

export class SkillService {
  private builtInSkills: Map<string, WriterSkill> = new Map()
  private initialized = false

  /**
   * Initialize the service by loading built-in skills.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return
    await this.loadBuiltInSkills()
    this.initialized = true
  }

  /**
   * Load all built-in skills from the resources/skills/ directory.
   */
  private async loadBuiltInSkills(): Promise<void> {
    const skillsDir = getBuiltInSkillsPath()

    if (!existsSync(skillsDir)) {
      console.warn(`[SkillService] Built-in skills directory not found: ${skillsDir}`)
      mkdirSync(skillsDir, { recursive: true })
      return
    }

    const files = readdirSync(skillsDir).filter((f) => f.endsWith('.skill.md'))

    for (const file of files) {
      try {
        const filePath = join(skillsDir, file)
        const content = readFileSync(filePath, 'utf-8')
        const skill = this.parseSkillFile(file, content, 'built-in')
        this.builtInSkills.set(skill.id, skill)
      } catch (error) {
        console.error(`[SkillService] Failed to load built-in skill ${file}:`, error)
      }
    }

    console.log(`[SkillService] Loaded ${this.builtInSkills.size} built-in skills`)
  }

  /**
   * Parse a .skill.md file into a WriterSkill object.
   *
   * Expected format:
   * ```
   * ---
   * name: Essay Writing
   * description: Rules for structured essay composition
   * tags: essay, academic, formal
   * ---
   *
   * # Essay Writing Skill
   *
   * ... markdown content ...
   * ```
   */
  private parseSkillFile(
    filename: string,
    raw: string,
    source: SkillSource,
  ): WriterSkill {
    const id = basename(filename, '.skill.md')
    let name = id
    let description = ''
    let tags: string[] = []
    let rubric: string | undefined
    let content = raw

    // Parse YAML front matter
    const frontMatterMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
    if (frontMatterMatch) {
      const frontMatter = frontMatterMatch[1]
      content = frontMatterMatch[2].trim()

      // Simple YAML parsing (no dependency needed for this)
      for (const line of frontMatter.split('\n')) {
        const colonIdx = line.indexOf(':')
        if (colonIdx === -1) continue
        const key = line.slice(0, colonIdx).trim()
        const value = line.slice(colonIdx + 1).trim()

        switch (key) {
          case 'name':
            name = value
            break
          case 'description':
            description = value
            break
          case 'tags':
            tags = value.split(',').map((t) => t.trim()).filter(Boolean)
            break
          case 'rubric':
            rubric = value
            break
        }
      }
    }

    const now = new Date().toISOString()

    return {
      id,
      name,
      description,
      content,
      source,
      createdAt: now,
      updatedAt: now,
      rubric,
      tags,
    }
  }

  /**
   * Load user/agent skills from a document's .lacon/skills/ directory.
   */
  private loadProjectSkills(documentId: string): WriterSkill[] {
    const ws = getProjectWorkspaceService()
    const skillsPath = ws.getSkillsPath(documentId)

    if (!existsSync(skillsPath)) return []

    const files = readdirSync(skillsPath).filter((f) => f.endsWith('.skill.md'))
    const skills: WriterSkill[] = []

    for (const file of files) {
      try {
        const filePath = join(skillsPath, file)
        const raw = readFileSync(filePath, 'utf-8')
        const skill = this.parseSkillFile(file, raw, 'user')
        skills.push(skill)
      } catch (error) {
        console.error(
          `[SkillService] Failed to load project skill ${file}:`,
          error,
        )
      }
    }

    return skills
  }

  /**
   * List all available skills (built-in + project-specific).
   */
  listSkills(
    documentId?: string,
    filter?: { source?: SkillSource; tag?: string },
  ): SkillListItem[] {
    this.ensureInitialized()

    const allSkills: WriterSkill[] = [
      ...this.builtInSkills.values(),
      ...(documentId ? this.loadProjectSkills(documentId) : []),
    ]

    let filtered = allSkills

    if (filter?.source) {
      filtered = filtered.filter((s) => s.source === filter.source)
    }

    if (filter?.tag) {
      const tag = filter.tag.toLowerCase()
      filtered = filtered.filter((s) =>
        s.tags.some((t) => t.toLowerCase() === tag),
      )
    }

    return filtered.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      source: s.source,
      tags: s.tags,
    }))
  }

  /**
   * Get a single skill by ID.
   */
  getSkill(skillId: string, documentId?: string): WriterSkill | null {
    this.ensureInitialized()

    // Check built-in first
    const builtIn = this.builtInSkills.get(skillId)
    if (builtIn) return builtIn

    // Check project skills
    if (documentId) {
      const projectSkills = this.loadProjectSkills(documentId)
      return projectSkills.find((s) => s.id === skillId) ?? null
    }

    return null
  }

  /**
   * Create a new user skill and save it to the project's .lacon/skills/.
   */
  createSkill(
    documentId: string,
    params: {
      name: string
      description: string
      content: string
      tags: string[]
      rubric?: string
    },
  ): WriterSkill {
    this.ensureInitialized()

    const ws = getProjectWorkspaceService()
    const skillsPath = ws.getSkillsPath(documentId)

    if (!existsSync(skillsPath)) {
      mkdirSync(skillsPath, { recursive: true })
    }

    // Generate a slug-based ID
    const id = params.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')

    const now = new Date().toISOString()

    const skill: WriterSkill = {
      id,
      name: params.name,
      description: params.description,
      content: params.content,
      source: 'user',
      createdAt: now,
      updatedAt: now,
      rubric: params.rubric,
      tags: params.tags,
    }

    // Serialize as .skill.md with YAML front matter
    const frontMatter = [
      '---',
      `name: ${skill.name}`,
      `description: ${skill.description}`,
      `tags: ${skill.tags.join(', ')}`,
      ...(skill.rubric ? [`rubric: ${skill.rubric}`] : []),
      '---',
      '',
    ].join('\n')

    const fileContent = frontMatter + skill.content
    const filePath = join(skillsPath, `${id}.skill.md`)
    writeFileSync(filePath, fileContent, 'utf-8')

    console.log(`[SkillService] Created skill "${skill.name}" at ${filePath}`)
    return skill
  }

  /**
   * Deterministic composition of up to 3 skills.
   *
   * The composed prompt follows this structure:
   * 1. Primary skill content (full)
   * 2. Secondary skill (supplementary rules only)
   * 3. Tertiary skill (supplementary rules only)
   *
   * Skills are merged by priority order — first skill is authoritative,
   * subsequent skills add constraints without overriding.
   */
  composeSkills(skillIds: string[], documentId?: string): ComposedSkill {
    this.ensureInitialized()

    if (skillIds.length === 0) {
      return {
        skillIds: [],
        composedPrompt: '',
        label: 'No skills selected',
      }
    }

    if (skillIds.length > 3) {
      throw new Error('Cannot compose more than 3 skills')
    }

    const skills: WriterSkill[] = []
    for (const id of skillIds) {
      const skill = this.getSkill(id, documentId)
      if (!skill) {
        throw new Error(`Skill not found: ${id}`)
      }
      skills.push(skill)
    }

    const sections: string[] = []

    // Primary skill — full content
    sections.push(`## Primary Writing Skill: ${skills[0].name}\n`)
    sections.push(skills[0].content)

    // Secondary skills — supplementary
    for (let i = 1; i < skills.length; i++) {
      sections.push(
        `\n## Supplementary Skill ${i}: ${skills[i].name}\n`,
      )
      sections.push(
        `Apply these additional rules alongside the primary skill:\n`,
      )
      sections.push(skills[i].content)
    }

    // Evaluation rubrics (if any)
    const rubrics = skills
      .filter((s) => s.rubric)
      .map((s) => `- ${s.name}: ${s.rubric}`)
    if (rubrics.length > 0) {
      sections.push('\n## Evaluation Criteria\n')
      sections.push(rubrics.join('\n'))
    }

    const label = skills.map((s) => s.name).join(' + ')

    return {
      skillIds,
      composedPrompt: sections.join('\n'),
      label,
    }
  }

  /**
   * Stub for skill research — will be fully implemented in Phase 5.
   * For now, returns a template skill based on the topic.
   */
  async researchAndCreateSkill(
    documentId: string,
    topic: string,
  ): Promise<WriterSkill> {
    this.ensureInitialized()

    console.log(
      `[SkillService] Research skill stub called for topic: "${topic}"`,
    )

    // Create a placeholder skill that the user can refine
    return this.createSkill(documentId, {
      name: `${topic} Writing`,
      description: `AI-researched skill for ${topic} writing (refine after research)`,
      content: [
        `# ${topic} Writing Skill`,
        '',
        `> This skill was auto-generated as a starting template for "${topic}" writing.`,
        '> It will be refined with real research in Phase 5.',
        '',
        '## Structure Rules',
        '',
        '1. Follow genre-appropriate structure',
        '2. Maintain consistent tone throughout',
        '3. Use domain-specific terminology accurately',
        '',
        '## Quality Criteria',
        '',
        '- Clear thesis or central argument',
        '- Logical flow between sections',
        '- Appropriate use of evidence and examples',
        '- Strong opening and conclusion',
        '',
        '## Common Pitfalls to Avoid',
        '',
        '- Over-generalization without specific evidence',
        '- Inconsistent tone shifts',
        '- Weak transitions between paragraphs',
      ].join('\n'),
      tags: [topic.toLowerCase(), 'auto-generated'],
    })
  }

  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SkillService not initialized. Call initialize() first.')
    }
  }
}

// ── Singleton ──
let instance: SkillService | null = null

export function getSkillService(): SkillService {
  if (!instance) {
    instance = new SkillService()
  }
  return instance
}
