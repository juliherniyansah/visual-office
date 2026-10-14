export const SITE = {
  name: 'VYRON',
  tagline: 'Where Humans and AI Work Together.',
  description: 'A design studio for the AI-native era. We build platforms, agents, and interfaces that make human-AI collaboration feel inevitable.',
  contactHref: 'mailto:hello@vyron.ai?subject=VYRON%20Early%20Access',
  url: 'https://vyron.ai',
} as const;

export const NAV_LINKS = [
  { label: 'Platform', href: '#platform' },
  { label: 'Virtual Office', href: '#office' },
  { label: 'AI Workforce', href: '#workforce' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'About', href: '#about' },
] as const;

export type SectionId = (typeof NAV_LINKS)[number]['href'] extends `#${infer S}` ? S : never;
export const SECTION_IDS = NAV_LINKS.map((l) => l.href.slice(1)) as SectionId[];

export const CAPABILITIES = [
  { title: 'Spatial Computing', body: 'Spatial interfaces that treat 3D space as a first-class surface.', status: 'current' as const },
  { title: 'Agent Orchestration', body: 'Role-based agents that plan, delegate, and execute.', status: 'current' as const },
  { title: 'Shared Context', body: 'Knowledge, tasks, and execution in a single workspace.', status: 'current' as const },
  { title: 'Real-Time Collaboration', body: 'Humans and agents working side-by-side in shared rooms.', status: 'current' as const },
  { title: 'Transparent Execution', body: 'Every agent action visible, auditable, reversible.', status: 'current' as const },
  { title: 'Predictive Workflows', body: 'Anticipate needs before they become tasks.', status: 'vision' as const },
  { title: 'Autonomous Decisioning', body: 'Agents that act within guardrails, escalate at boundaries.', status: 'vision' as const },
  { title: 'Cross-Company Intelligence', body: 'Shared learnings across organizations, privacy-preserving.', status: 'vision' as const },
] as const;

export const AGENTS = [
  { role: 'CEO', body: 'Sets direction and approves company-level objectives.' },
  { role: 'COO', body: 'Turns objectives into coordinated operational plans.' },
  { role: 'CTO', body: 'Owns technical strategy and system architecture decisions.' },
  { role: 'Programming Agent', body: 'Implements tasks and reports execution status.' },
] as const;

export const STEPS = [
  { number: '01', title: 'Define', body: 'State the goal in plain language.' },
  { number: '02', title: 'Delegate', body: 'Agents break it into tasks and carry them out.' },
  { number: '03', title: 'Deliver', body: 'Follow progress and results in the shared environment.' },
] as const;

export const PLATFORM_CARDS = [
  { title: 'A Living Virtual Office', body: 'A spatial headquarters where people and agents share rooms, floors, and context.' },
  { title: 'An Intelligent AI Workforce', body: 'Role-based agents that plan, delegate, and execute work alongside your team.' },
  { title: 'One Connected Operating Environment', body: 'Knowledge, tasks, and execution status in a single shared workspace.' },
] as const;

export const AI_CORE_NODES = [
  { label: 'Task Queue', body: 'Incoming work, prioritized and routed.' },
  { label: 'Agent Runtime', body: 'Where agents execute and report.' },
  { label: 'Context Store', body: 'Shared knowledge, versioned and searchable.' },
  { label: 'Execution Log', body: 'Every action, auditable and reversible.' },
  { label: 'Guardrails', body: 'Boundaries that constrain agent autonomy.' },
  { label: 'Escalation Path', body: 'When agents hit limits, humans take over.' },
] as const;

export const AUDIENCE_GROUPS = [
  { label: 'Founders', body: 'Running lean teams that need leverage, not headcount.' },
  { label: 'Operators', body: 'Coordinating complex workflows across humans and agents.' },
  { label: 'Builders', body: 'Shipping products that require transparent, auditable execution.' },
] as const;

export const FLOORS = [
  { level: 'Floor 1', name: 'Lobby & AI Core', description: 'The entry point. Visitors meet the AI core that orchestrates all agent activity.' },
  { level: 'Floor 2', name: 'Domain Agents', description: 'Specialized agents organized by function: finance, operations, customer success, engineering.' },
  { level: 'Floor 3', name: 'Executive Offices', description: 'Where human leadership collaborates with agent counterparts on strategy and decisions.' },
  { level: 'Floor 4', name: 'CEO Suite', description: 'The top floor. Final oversight, escalation resolution, and human-AI alignment.' },
] as const;

export const COPY = {
  platformIntro: 'Not another dashboard. A new way to run a company.',
  officeIntro: 'Explore a four-floor digital headquarters: lobby and AI core, domain agents, executive offices, and the CEO suite.',
  workforceIntro: 'Meet the agents that work alongside your team.',
  aiCoreIntro: {
    title: 'The AI Core',
    body: 'VYRON is built on a small set of connected systems that make human-AI collaboration transparent, auditable, and reversible.',
  },
  howItWorksIntro: 'Three steps from goal to delivery.',
  aboutIntro: 'VYRON is a design studio for the AI-native era.',
  finalCtaTitle: 'Ready to build your AI company?',
  finalCtaBody: 'We are opening early access to a small group of founders and operators who want to shape what human-AI collaboration looks like.',
  finalCtaPrimaryButton: 'Request Early Access',
  finalCtaSecondaryButton: 'Learn More',
  visionHeading: 'Vision',
} as const;
