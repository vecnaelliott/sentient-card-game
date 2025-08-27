// /api/score.js
import { kv } from '@vercel/kv';

function sanitizeHandle(v=''){ return v.toString().trim().replace(/^@+/, '').toLowerCase(); }

export default async function handler(req, res){
  try{
    if(req.method === 'GET'){
      const n = Math.min(parseInt(req.query.n||'20',10)||20, 100);
      const rows = await kv.zrange('sc:scores', 0, n-1, { withScores: true });
      const users = rows.map(r=>r.member);
      const profiles = await Promise.all(users.map(u=> kv.hgetall(`sc:profile:${u}`)));
      const items = rows.map((r,i)=>({ username: r.member, bestMs: Number(r.score), avatar: profiles[i]?.avatar || '' }));
      return res.status(200).json({ ok:true, items });
    }

    if(req.method === 'POST'){
      const { username, avatar, ms } = req.body || {};
      const clean = sanitizeHandle(username);
      const timeMs = Number(ms);
      if(!clean || !Number.isFinite(timeMs) || timeMs<=0 || clean.length>32){
        return res.status(400).json({ ok:false, error:'invalid_input' });
      }
      if(avatar && typeof avatar==='string'){
        await kv.hset(`sc:profile:${clean}`, { avatar, updatedAt: Date.now() });
      }
      const cur = await kv.zscore('sc:scores', clean);
      if(cur===null || timeMs < Number(cur)){
        await kv.zadd('sc:scores', { score: timeMs, member: clean });
      }
      const bestMs = Number(await kv.zscore('sc:scores', clean));
      const rank = await kv.zrank('sc:scores', clean);
      return res.status(200).json({ ok:true, bestMs, rank });
    }

    res.setHeader('Allow', ['GET','POST']);
    return res.status(405).json({ ok:false, error:'method_not_allowed' });
  }catch(err){
    console.error(err);
    return res.status(500).json({ ok:false, error:'server_error' });
  }
}
