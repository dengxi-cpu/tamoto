// api/sync.js
// 推/拉同步 API（使用 Supabase REST API）
const { supabaseFetch, isReady } = require('./_supabase.js');

async function handler(req, res) {
  if (!isReady) {
    return res.status(503).json({ success: false, error: '数据库未配置' });
  }

  try {
    const authHeader = req.headers.authorization || '';
    const identityHash = authHeader.replace('Bearer ', '').trim();

    if (!identityHash) {
      return res.status(401).json({ success: false, error: '未授权' });
    }

    // 查找用户
    const userResp = await supabaseFetch(
      `users?identity_hash=eq.${encodeURIComponent(identityHash)}&select=id`,
      { headers: { 'Prefer': 'count=exact' } }
    );

    if (!userResp.ok) {
      throw new Error(`查询用户失败: ${userResp.status}`);
    }

    const users = await userResp.json();
    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, error: '用户未注册' });
    }

    const userId = users[0].id;
    const now = new Date().toISOString();

    // ======== POST: 推送数据 ========
    if (req.method === 'POST') {
      const { ocData, tasks, stats, chatHistory, preferences } = req.body;
      const errors = [];

      if (ocData !== undefined) {
        const r = await supabaseFetch('oc_data', {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, data: ocData, updated_at: now }),
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
        });
        if (!r.ok) errors.push('oc_data: ' + await r.text());
      }

      if (tasks !== undefined) {
        const r = await supabaseFetch('tasks', {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, data: tasks, updated_at: now }),
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
        });
        if (!r.ok) errors.push('tasks: ' + await r.text());
      }

      if (stats !== undefined) {
        const r = await supabaseFetch('stats', {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, data: stats, updated_at: now }),
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
        });
        if (!r.ok) errors.push('stats: ' + await r.text());
      }

      if (chatHistory !== undefined) {
        const r = await supabaseFetch('chat_history', {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, data: chatHistory, updated_at: now }),
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
        });
        if (!r.ok) errors.push('chat_history: ' + await r.text());
      }

      if (preferences !== undefined) {
        const r = await supabaseFetch('user_preferences', {
          method: 'POST',
          body: JSON.stringify({ user_id: userId, data: preferences, updated_at: now }),
          headers: { 'Prefer': 'resolution=merge-duplicates,return=minimal' }
        });
        if (!r.ok) errors.push('preferences: ' + await r.text());
      }

      // 更新用户最后同步时间
      await supabaseFetch(
        `users?id=eq.${encodeURIComponent(userId)}`,
        { method: 'PATCH', body: JSON.stringify({ last_sync_at: now }), headers: { 'Prefer': 'return=minimal' } }
      );

      return res.status(200).json({
        success: true,
        errors: errors.length > 0 ? errors : undefined,
        serverTime: now
      });
    }

    // ======== GET: 拉取数据 ========
    if (req.method === 'GET') {
      const since = req.query.since || '1970-01-01T00:00:00Z';
      const isBootstrap = req.query.bootstrap === 'true';

      const fetchRow = async (table) => {
        const r = await supabaseFetch(
          `${table}?user_id=eq.${encodeURIComponent(userId)}&select=data,updated_at`,
          { headers: { 'Prefer': 'count=exact' } }
        );
        if (!r.ok) return null;
        const rows = await r.json();
        return rows && rows.length > 0 ? rows[0] : null;
      };

      const [ocDataRow, tasksRow, statsRow, chatRow, prefsRow] = await Promise.all([
        fetchRow('oc_data'),
        fetchRow('tasks'),
        fetchRow('stats'),
        fetchRow('chat_history'),
        fetchRow('user_preferences')
      ]);

      await supabaseFetch(
        `users?id=eq.${encodeURIComponent(userId)}`,
        { method: 'PATCH', body: JSON.stringify({ last_sync_at: now }), headers: { 'Prefer': 'return=minimal' } }
      );

      const result = { success: true, serverTime: now, changes: {} };

      if (ocDataRow && (isBootstrap || ocDataRow.updated_at > since)) result.changes.ocData = ocDataRow.data;
      if (tasksRow && (isBootstrap || tasksRow.updated_at > since)) result.changes.tasks = tasksRow.data;
      if (statsRow && (isBootstrap || statsRow.updated_at > since)) result.changes.stats = statsRow.data;
      if (chatRow && (isBootstrap || chatRow.updated_at > since)) result.changes.chatHistory = chatRow.data;
      if (prefsRow && (isBootstrap || prefsRow.updated_at > since)) result.changes.preferences = prefsRow.data;

      return res.status(200).json(result);
    }

    return res.status(405).json({ success: false, error: 'Method not allowed' });
  } catch (error) {
    console.error('Sync API 错误:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = handler;
