import { hasPhrase, norm } from './text';

// Canonical skill name → aliases (matched as whole phrases on normalized text).
// "core" marks skills a typical analyst JD treats as hard requirements; missing
// core skills weigh more in rejection-risk analysis.
interface SkillDef { name: string; aliases: string[]; group: SkillGroup; core?: boolean }
export type SkillGroup = 'tool' | 'technical' | 'analysis' | 'business' | 'domain';

const S = (name: string, group: SkillGroup, aliases: string[] = [], core = false): SkillDef => ({ name, group, aliases, core });

export const SKILLS: SkillDef[] = [
  // tools
  S('SQL', 'tool', ['sql', 'mysql', 'postgresql', 'postgres', 't-sql', 'tsql', 'pl/sql', 'plsql', 'sql server', 'ms sql'], true),
  S('Microsoft Excel', 'tool', ['excel', 'ms excel', 'microsoft excel', 'advanced excel', 'spreadsheets', 'vlookup', 'xlookup', 'pivot tables', 'pivot table'], true),
  S('Power BI', 'tool', ['power bi', 'powerbi', 'pbi'], true),
  S('Tableau', 'tool', ['tableau'], true),
  S('DAX', 'tool', ['dax']),
  S('Power Query', 'tool', ['power query', 'm language']),
  S('Python', 'tool', ['python'], true),
  S('R', 'tool', ['r programming', 'r studio', 'rstudio', 'r language']),
  S('Pandas', 'tool', ['pandas']),
  S('NumPy', 'tool', ['numpy']),
  S('Looker', 'tool', ['looker', 'looker studio', 'google data studio', 'data studio']),
  S('Qlik', 'tool', ['qlik', 'qlikview', 'qlik sense']),
  S('Google Analytics', 'tool', ['google analytics', 'ga4']),
  S('Mixpanel', 'tool', ['mixpanel']),
  S('Amplitude', 'tool', ['amplitude']),
  S('Snowflake', 'tool', ['snowflake']),
  S('BigQuery', 'tool', ['bigquery', 'big query']),
  S('Redshift', 'tool', ['redshift']),
  S('dbt', 'tool', ['dbt']),
  S('Airflow', 'tool', ['airflow']),
  S('Alteryx', 'tool', ['alteryx']),
  S('SSRS', 'tool', ['ssrs']),
  S('SSIS', 'tool', ['ssis']),
  S('VBA', 'tool', ['vba', 'macros']),
  S('Salesforce', 'tool', ['salesforce', 'sfdc']),
  S('SAP', 'tool', ['sap']),
  S('Workday', 'tool', ['workday hcm']),
  S('Jira', 'tool', ['jira']),
  S('Confluence', 'tool', ['confluence']),
  S('Google Sheets', 'tool', ['google sheets']),
  S('PowerPoint', 'tool', ['powerpoint', 'ms powerpoint']),
  S('Visio', 'tool', ['visio']),
  S('Spark', 'tool', ['spark', 'pyspark', 'databricks']),
  S('AWS', 'tool', ['aws', 'amazon web services']),
  S('Azure', 'tool', ['azure']),
  S('GCP', 'tool', ['gcp', 'google cloud']),
  S('Git', 'tool', ['git', 'github']),
  // technical
  S('Data Analysis', 'technical', ['data analysis', 'analyse data', 'analyze data', 'analysing data', 'analyzing data', 'data analytics'], true),
  S('Data Visualization', 'technical', ['data visualization', 'data visualisation', 'visualization', 'visualisation']),
  S('Dashboard Development', 'technical', ['dashboard', 'dashboards', 'dashboarding', 'dashboard development']),
  S('Reporting', 'technical', ['reporting', 'reports', 'mis reporting', 'mis']),
  S('Data Modeling', 'technical', ['data modeling', 'data modelling', 'star schema', 'dimensional modeling']),
  S('ETL', 'technical', ['etl', 'elt', 'data pipelines', 'data pipeline']),
  S('Data Cleaning', 'technical', ['data cleaning', 'data cleansing', 'data wrangling', 'data quality']),
  S('Statistics', 'technical', ['statistics', 'statistical analysis', 'statistical', 'regression', 'hypothesis testing']),
  S('A/B Testing', 'technical', ['a/b testing', 'a b testing', 'ab testing', 'experimentation', 'experiments']),
  S('Forecasting', 'technical', ['forecasting', 'forecast', 'time series']),
  S('Machine Learning', 'technical', ['machine learning', 'ml models', 'predictive modeling', 'predictive modelling', 'scikit-learn', 'sklearn']),
  S('Business Intelligence', 'technical', ['business intelligence', 'bi tools', 'bi reporting', 'bi developer']),
  // analysis / BA craft
  S('Business Analysis', 'analysis', ['business analysis', 'business analyst'], true),
  S('Requirements Gathering', 'analysis', ['requirements gathering', 'requirement gathering', 'gather requirements', 'gathered requirements', 'gathering requirements', 'requirements analysis', 'requirements elicitation', 'elicit requirements', 'brd', 'frd', 'business requirements'], true),
  S('User Stories', 'analysis', ['user stories', 'acceptance criteria']),
  S('Process Mapping', 'analysis', ['process mapping', 'process maps', 'bpmn', 'workflow mapping', 'as-is', 'to-be']),
  S('Process Improvement', 'analysis', ['process improvement', 'process optimization', 'process optimisation', 'continuous improvement', 'lean', 'six sigma']),
  S('Documentation', 'analysis', ['documentation', 'sops', 'sop', 'process documentation']),
  S('KPI Analysis', 'analysis', ['kpi', 'kpis', 'metrics', 'okrs', 'key performance indicators']),
  S('Gap Analysis', 'analysis', ['gap analysis']),
  S('Root Cause Analysis', 'analysis', ['root cause analysis', 'root cause', 'rca']),
  S('Research & Insights', 'analysis', ['research', 'insights', 'insight generation', 'market research']),
  S('UAT', 'analysis', ['uat', 'user acceptance testing']),
  S('Agile', 'analysis', ['agile', 'scrum', 'kanban', 'sprint']),
  S('Product Analytics', 'analysis', ['product analytics', 'funnel analysis', 'cohort analysis', 'retention analysis']),
  // business
  S('Stakeholder Management', 'business', ['stakeholder management', 'stakeholders', 'stakeholder engagement', 'cross-functional', 'cross functional'], true),
  S('Communication', 'business', ['communication skills', 'presentation skills', 'storytelling', 'data storytelling']),
  S('Project Management', 'business', ['project management', 'project coordination', 'pmp']),
  S('Operations Management', 'business', ['operations management', 'operational analytics', 'operations analysis', 'business operations']),
  S('Financial Analysis', 'business', ['financial analysis', 'financial modeling', 'financial modelling', 'budgeting', 'p&l', 'p and l']),
  S('Strategy', 'business', ['strategy', 'strategic planning', 'business strategy']),
  S('Change Management', 'business', ['change management']),
  // domain
  S('People Analytics', 'domain', ['people analytics', 'hr analytics', 'workforce analytics', 'hris']),
  S('Education Operations', 'domain', ['education', 'edtech', 'academic', 'educational operations', 'student']),
  S('E-commerce', 'domain', ['e-commerce', 'ecommerce', 'retail']),
  S('Healthcare', 'domain', ['healthcare', 'health care', 'clinical', 'hospital']),
  S('Financial Services', 'domain', ['banking', 'fintech', 'financial services', 'payments', 'insurance']),
  S('SaaS', 'domain', ['saas', 'b2b software']),
  S('Supply Chain', 'domain', ['supply chain', 'logistics', 'inventory', 'procurement']),
  S('Marketing Analytics', 'domain', ['marketing analytics', 'campaign analysis', 'seo', 'crm analytics']),
  S('Consulting', 'domain', ['consulting', 'consultancy', 'client-facing', 'client facing']),
];

const SKILL_INDEX = SKILLS.map((s) => ({ ...s, norms: [norm(s.name), ...s.aliases.map(norm)] }));

/** Single-letter "R" needs special handling to avoid matching every stray r. */
function hasRLanguage(raw: string): boolean {
  return /(^|[\s,(/])R([\s,)/]|$)(?!&)/.test(raw) && /\b(python|sql|statistic|programming|rstudio)\b/i.test(raw);
}

export function extractSkills(text: string): string[] {
  const n = norm(text);
  const found: string[] = [];
  for (const s of SKILL_INDEX) {
    if (s.name === 'R') {
      if (s.norms.slice(1).some((a) => hasPhrase(n, a)) || hasRLanguage(text)) found.push(s.name);
      continue;
    }
    if (s.norms.some((a) => hasPhrase(n, a))) found.push(s.name);
  }
  return found;
}

export function skillGroup(name: string): SkillGroup | null {
  return SKILLS.find((s) => s.name === name)?.group ?? null;
}

export function isCoreSkill(name: string): boolean {
  return !!SKILLS.find((s) => s.name === name)?.core;
}

export const DOMAIN_SKILLS = SKILLS.filter((s) => s.group === 'domain').map((s) => s.name);

/** Responsibility themes for the 20-point responsibilities component. */
export const RESPONSIBILITY_THEMES: { name: string; patterns: string[] }[] = [
  { name: 'Build and maintain dashboards', patterns: ['dashboard', 'dashboards', 'visualization', 'visualisation'] },
  { name: 'Recurring and ad-hoc reporting', patterns: ['reporting', 'reports', 'ad hoc', 'ad-hoc', 'mis'] },
  { name: 'Track KPIs and performance metrics', patterns: ['kpi', 'kpis', 'metrics', 'performance'] },
  { name: 'Gather and document requirements', patterns: ['requirements', 'requirement', 'user stories', 'brd'] },
  { name: 'Work with stakeholders', patterns: ['stakeholder', 'stakeholders', 'cross functional', 'cross-functional', 'business partners'] },
  { name: 'Improve processes', patterns: ['process improvement', 'improve processes', 'optimize', 'optimise', 'efficiency', 'automation', 'automate'] },
  { name: 'Query and analyse data', patterns: ['sql', 'query', 'queries', 'analyse', 'analyze', 'analysis'] },
  { name: 'Produce insights and recommendations', patterns: ['insights', 'recommendations', 'storytelling', 'present findings'] },
  { name: 'Documentation and SOPs', patterns: ['documentation', 'document', 'sop', 'sops'] },
  { name: 'Research', patterns: ['research', 'investigate', 'market analysis'] },
  { name: 'Operational analysis', patterns: ['operations', 'operational', 'capacity', 'workforce', 'scheduling'] },
  { name: 'Data quality and governance', patterns: ['data quality', 'data integrity', 'governance', 'data validation'] },
  { name: 'Forecasting and planning', patterns: ['forecast', 'forecasting', 'planning', 'budget'] },
  { name: 'Experimentation', patterns: ['a/b', 'experiment', 'experimentation', 'hypothesis'] },
  { name: 'Statistical / ML modelling', patterns: ['model', 'modeling', 'modelling', 'machine learning', 'predictive'] },
];

export function detectThemes(text: string): string[] {
  const n = norm(text);
  return RESPONSIBILITY_THEMES.filter((t) => t.patterns.some((p) => hasPhrase(n, norm(p)))).map((t) => t.name);
}
