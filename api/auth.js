// api/auth.js
// 设备注册 + 同步码配对 API（使用 Supabase REST API）
const { supabaseFetch, isReady } = require('./_supabase.js');

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method not allowed' });
  }

  if (!isReady) {
    return res.status(503).json({ success: false, error: '数据库未配置' });
  }

  try {
    const { action, identityHash } = req.body;

    if (!identityHash) {
      return res.status(400).json({ success: false, error: '缺少 identityHash' });
    }

    if (action === 'register') {
      // 清理旧版 SHA-256 哈希记录（64位十六进制），迁移到明文同步码
      try {
        const allResp = await supabaseFetch('users?select=id,identity_hash');
        if (allResp.ok) {
          const allUsers = await allResp.json();
          const oldIds = allUsers
            .filter(u => u.identity_hash && /^[a-f0-9]{64}$/i.test(u.identity_hash))
            .map(u => u.id);
          if (oldIds.length > 0) {
            await supabaseFetch(
              `users?id=in.(${oldIds.join(',')})`,
              { method: 'DELETE', headers: { 'Prefer': 'return=minimal' } }
            );
            console.log('Auth: 已清理', oldIds.length, '条旧哈希记录');
          }
        }
      } catch (e) {
        console.warn('Auth: 清理旧记录失败（非致命）', e.message);
      }

      // 查找已有用户
      const findResp = await supabaseFetch(
        `users?identity_hash=eq.${encodeURIComponent(identityHash)}&select=id`,
        { headers: { 'Prefer': 'count=exact' } }
      );

      if (!findResp.ok && findResp.status !== 404) {
        const errText = await findResp.text();
        throw new Error(`查询用户失败: ${findResp.status} ${errText}`);
      }

      const existingUsers = findResp.status === 404 ? [] : await findResp.json();

      if (existingUsers && existingUsers.length > 0) {
        // 已存在的用户，更新时间戳
        const userId = existingUsers[0].id;
        await supabaseFetch(
          `users?id=eq.${encodeURIComponent(userId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify({ last_sync_at: new Date().toISOString() }),
            headers: { 'Prefer': 'return=minimal' }
          }
        );

        return res.status(200).json({
          success: true,
          userId,
          isNew: false
        });
      }

      // 创建新用户
      const createResp = await supabaseFetch('users', {
        method: 'POST',
        body: JSON.stringify({ identity_hash: identityHash }),
        headers: { 'Prefer': 'return=representation' }
      });

      if (!createResp.ok) {
        const errText = await createResp.text();
        throw new Error(`创建用户失败: ${createResp.status} ${errText}`);
      }

      const newUser = await createResp.json();
      return res.status(201).json({
        success: true,
        userId: newUser[0].id,
        isNew: true
      });
    }

    return res.status(400).json({ success: false, error: '未知 action' });
  } catch (error) {
    console.error('Auth API 错误:', error);
    return res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = handler;
