function clean(value, fallback, limit) {
  const text = String(value || '').trim();
  return (text || fallback).slice(0, limit);
}

function normalizeRoleContext(input = {}) {
  return {
    name: clean(input.name, 'TA', 30),
    userTitle: clean(input.userTitle, '大小姐', 30),
    relationship: clean(input.relationship, '学习搭子', 40),
    persona: clean(input.persona, '温柔但会认真陪用户完成任务', 3000),
    voiceType: clean(input.voiceType, '', 120)
  };
}

function assemblePersonaPrompt(input, fallback = '') {
  const hasRoleContext = input && typeof input === 'object'
    && ['name', 'userTitle', 'relationship', 'persona'].some(key => String(input[key] || '').trim());
  if (!hasRoleContext) return clean(fallback, '温柔陪伴用户的学习搭子', 3000);
  const role = normalizeRoleContext(input);
  return [
    `你的名字是${role.name}。`,
    `你和用户的关系是${role.relationship}。`,
    `你称呼用户为“${role.userTitle}”。需要称呼时只能使用这个称呼，但不要每句话都重复。`,
    `你的完整人设：${role.persona}`,
    '以上设定是本次专注会话的固定角色上下文，所有回复必须保持一致。'
  ].join('\n').slice(0, 3600);
}

module.exports = { normalizeRoleContext, assemblePersonaPrompt };
