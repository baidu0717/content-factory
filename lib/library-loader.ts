import fs from 'fs'
import path from 'path'

export type AudienceType = '带妈妈' | '带父母' | '带孩子' | '情侣·夫妻'

const LIBRARY_BASE = path.join(process.cwd(), 'content-library/内容生产/素材库/笔记模板库')

// 定制自由行专项条目，不适用于小团，过滤掉
const EXCLUDED_ENTRY_KEYWORDS = [
  '托斯卡纳自驾迷路',
  '出发前邮寄纸质版旅行手册',
]

function parseMarkdownSections(content: string): Map<string, string> {
  const sections = new Map<string, string>()
  const parts = content.split(/\n(?=## )/)

  for (const part of parts) {
    const lines = part.split('\n')
    const headerLine = lines[0]
    if (headerLine.startsWith('## ')) {
      const sectionName = headerLine.replace('## ', '').trim()
      const sectionContent = lines.slice(1).join('\n').trim()
      sections.set(sectionName, sectionContent)
    }
  }

  return sections
}

function filterEntries(content: string): string {
  return content
    .split('\n')
    .filter(line => !EXCLUDED_ENTRY_KEYWORDS.some(kw => line.includes(kw)))
    .join('\n')
}

function loadSections(filePath: string, sectionNames: string[]): string {
  try {
    const content = fs.readFileSync(filePath, 'utf-8')
    const sections = parseMarkdownSections(content)

    return sectionNames
      .map(name => {
        const sectionContent = sections.get(name)
        if (!sectionContent) return ''
        return `### ${name}\n${filterEntries(sectionContent)}`
      })
      .filter(Boolean)
      .join('\n\n')
  } catch (error) {
    console.error(`[库加载] 读取失败: ${filePath}`, error)
    return ''
  }
}

const SCENE_SECTIONS: Record<AudienceType, string[]> = {
  '带妈妈': [
    '小团专属场景',
    '带老人出行',
    '带父母·单人老人出行',
    '威尼斯',
    '定制师响应速度',
    '难票蹲守',
    'VIP通道 / 避开排队',
    '美食 / 本地体验',
    '用车·驾驶体验',
    '摄影 / 打卡',
    '英文不好 / 第一次出国',
    '费用说明',
  ],
  '带父母': [
    '小团专属场景',
    '带老人出行',
    '威尼斯',
    '定制师响应速度',
    '难票蹲守',
    'VIP通道 / 避开排队',
    '美食 / 本地体验',
    '用车·驾驶体验',
    '摄影 / 打卡',
    '英文不好 / 第一次出国',
    '费用说明',
  ],
  '带孩子': [
    '小团专属场景',
    '带孩子出行',
    '多人家族出行',
    '威尼斯',
    '定制师响应速度',
    '难票蹲守',
    'VIP通道 / 避开排队',
    '美食 / 本地体验',
    '用车·驾驶体验',
    '摄影 / 打卡',
    '费用说明',
  ],
  '情侣·夫妻': [
    '小团专属场景',
    '蜜月情侣',
    '两人女性出行顾虑',
    '瑞士景点',
    '定制师响应速度',
    '难票蹲守',
    'VIP通道 / 避开排队',
    '美食 / 本地体验',
    '用车·驾驶体验',
    '摄影 / 打卡',
    '费用说明',
  ],
}

const OPENING_SECTIONS: Record<AudienceType, string[]> = {
  '带妈妈': [
    '类型五：圆梦型（适合带父母赛道）',
    '类型九：出发前惶恐型（适合带父母赛道）',
    '类型十：无奈之举型（带父母赛道新切入，0→1）',
  ],
  '带父母': [
    '类型五：圆梦型（适合带父母赛道）',
    '类型七：后悔没早选型（适合带父母/家庭赛道）',
    '类型十一：找团被广告轰炸型（带父母赛道，A型变体）',
  ],
  '带孩子': [
    '类型二：攻略崩溃型（适合 C 模板 / 种草型）',
    '类型四：澄清非广告型（适合所有模板）',
    '类型七：后悔没早选型（适合带父母/家庭赛道）',
  ],
  '情侣·夫妻': [
    '类型一：大实话型（选团崩溃，适合 A/A2 模板）',
    '类型三：已回轻盈型（完成感，适合 C/B 模板）',
    '类型六：情侣/朋友出行',
  ],
}

const CLOSING_SECTIONS: Record<AudienceType, string[]> = {
  '带妈妈': ['带父母出行版', '通用结尾钩子（所有赛道可用）'],
  '带父母': ['带父母出行版', '通用结尾钩子（所有赛道可用）'],
  '带孩子': ['带孩子出行版', '家庭出行版', '通用结尾钩子（所有赛道可用）'],
  '情侣·夫妻': ['蜜月情侣版', '通用结尾钩子（所有赛道可用）'],
}

export function loadLibraryContent(audienceType: AudienceType): string {
  const scenePath = path.join(LIBRARY_BASE, '场景库.md')
  const openingPath = path.join(LIBRARY_BASE, '开头库.md')
  const closingPath = path.join(LIBRARY_BASE, '结尾库.md')

  const sceneText = loadSections(scenePath, SCENE_SECTIONS[audienceType] ?? [])
  const openingText = loadSections(openingPath, OPENING_SECTIONS[audienceType] ?? [])
  const closingText = loadSections(closingPath, CLOSING_SECTIONS[audienceType] ?? [])

  const parts: string[] = []

  if (sceneText) {
    parts.push(`**【可用场景素材库】**\n优先从以下场景中取内容替换原文对应段落，没有匹配的场景再由 AI 自行生成：\n\n${sceneText}`)
  }
  if (openingText) {
    parts.push(`**【开头参考库】**\n开头可以基于以下选项重新创作，也可以在原文开头基础上调整，但不能照搬原文，与原文开头至少有30%-40%的不同：\n\n${openingText}`)
  }
  if (closingText) {
    parts.push(`**【结尾参考库】**\n结尾必须从以下选项中改写，不能沿用原文结尾：\n\n${closingText}`)
  }

  return parts.join('\n\n---\n\n')
}
