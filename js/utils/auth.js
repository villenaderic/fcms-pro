'use strict';
const Auth = (() => {
  const SESSION_KEY = 'fcms_session';
  const LOCK_KEY    = 'fcms_lock';
  const MAX_ATT     = 5;
  const LOCK_MS     = 15 * 60 * 1000;
  const SESSION_TTL = 8  * 60 * 60 * 1000;

  /* LOCKOUT */
  const getLock = () => { try { return JSON.parse(localStorage.getItem(LOCK_KEY)) || {att:0,until:0}; } catch { return {att:0,until:0}; } };
  const setLock = d => localStorage.setItem(LOCK_KEY, JSON.stringify(d));
  const isLocked = () => getLock().until > Date.now();
  const lockRemaining = () => { const ms = getLock().until - Date.now(); if(ms<=0) return null; return Math.ceil(ms/60000)+'m'; };
  const failedAttempt = () => { const l=getLock(); l.att=(l.att||0)+1; if(l.att>=MAX_ATT) l.until=Date.now()+LOCK_MS; setLock(l); };
  const clearLock = () => localStorage.removeItem(LOCK_KEY);

  /* SESSION */
  const getSession = () => { try { const s=JSON.parse(sessionStorage.getItem(SESSION_KEY)); if(!s) return null; if(Date.now()>s.exp){logout();return null;} return s; } catch{return null;} };
  const createSession = user => { const s={user,exp:Date.now()+SESSION_TTL,tok:H.uid('tok')}; sessionStorage.setItem(SESSION_KEY,JSON.stringify(s)); return s; };
  const logout = () => sessionStorage.removeItem(SESSION_KEY);
  const isLoggedIn = () => !!getSession();
  const currentUser = () => { const s=getSession(); return s?s.user:null; };

  /* SETUP */
  const isSetupDone = async () => { const a=await DB.getAll('auth'); return a.length>0; };
  const createAdmin = async (username,password,biz) => {
    const existing = await DB.getAll('auth');
    if (existing.length) throw new Error('Admin already exists');
    const hash = await H.hashPwd(password);
    await DB.put('auth', { id:'admin', username:username.trim().toLowerCase(), hash, biz:biz.trim(), createdAt:H.now() });
    const s = Settings.getAll(); s.businessName = biz.trim(); Settings.saveAll(s);
  };
  const verifyLogin = async (user,pass) => {
    const arr = await DB.getAll('auth');
    const admin = arr.find(a => a.username === user.trim().toLowerCase());
    if (!admin) return false;
    return H.verifyPwd(pass, admin.hash);
  };
  const changePassword = async (oldPass,newPass) => {
    const arr = await DB.getAll('auth');
    const admin = arr[0]; if(!admin) throw new Error('No admin found');
    const ok = await H.verifyPwd(oldPass, admin.hash);
    if (!ok) throw new Error('Current password is incorrect');
    admin.hash = await H.hashPwd(newPass);
    await DB.put('auth', admin);
  };
  const getAdminInfo = async () => { const a=await DB.getAll('auth'); return a[0]||null; };

  // B1: Idle session auto-lock (30 minutes)
  const IDLE_MS = 30 * 60 * 1000;
  let _idleTimer = null;

  const resetIdle = () => {
    clearTimeout(_idleTimer);
    _idleTimer = setTimeout(() => {
      logout();
      window.dispatchEvent(new CustomEvent('fcms:idle-lock'));
    }, IDLE_MS);
  };
  const clearIdle = () => clearTimeout(_idleTimer);

  return { isSetupDone,createAdmin,verifyLogin,changePassword,getAdminInfo,isLocked,lockRemaining,failedAttempt,clearLock,isLoggedIn,currentUser,createSession,logout,resetIdle,clearIdle };
})();
