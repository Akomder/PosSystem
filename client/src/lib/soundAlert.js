/**
 * soundAlert.js — Web Audio API sound alerts (no external deps, no audio files)
 *
 * Uses a singleton AudioContext to avoid repeated context creation.
 * Browsers require a user gesture before audio can play — call unlock()
 * inside a click/touch handler to warm up the context first.
 */

let _ctx = null

function getCtx() {
  if (_ctx && _ctx.state !== 'closed') return _ctx
  _ctx = new (window.AudioContext || window.webkitAudioContext)()
  return _ctx
}

function tone(ctx, freq, startTime, duration, gainVal = 0.35, type = 'sine') {
  try {
    const osc  = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = type
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0, startTime)
    gain.gain.linearRampToValueAtTime(gainVal, startTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
    osc.start(startTime)
    osc.stop(startTime + duration)
  } catch (_) {}
}

/** Warm up the AudioContext on first user interaction (required by browsers). */
export function unlock() {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()
  } catch (_) {}
}

export function isUnlocked() {
  try { return _ctx && _ctx.state === 'running' } catch { return false }
}

/**
 * Kitchen alert — two urgent descending bell tones.
 * Designed to cut through kitchen noise.
 */
export function playKitchenAlert() {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const t = ctx.currentTime
    tone(ctx, 880, t,        0.45, 0.45)   // high bell
    tone(ctx, 880, t + 0.08, 0.30, 0.20)   // echo
    tone(ctx, 660, t + 0.30, 0.50, 0.40)   // lower follow
    tone(ctx, 660, t + 0.38, 0.35, 0.18)   // echo
  } catch (_) {}
}

/**
 * Cashier alert — three ascending musical tones (C-E-G major chord).
 * Pleasant, attention-grabbing without being alarming.
 */
export function playCashierAlert() {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const t = ctx.currentTime
    tone(ctx, 523, t,        0.25, 0.30)   // C5
    tone(ctx, 659, t + 0.16, 0.25, 0.30)   // E5
    tone(ctx, 784, t + 0.32, 0.40, 0.38)   // G5 (longer final)
  } catch (_) {}
}

/**
 * Urgent alert — three rapid high-pitched tones.
 * Used for QR payment requests.
 */
export function playUrgentAlert() {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') ctx.resume()
    const t = ctx.currentTime
    tone(ctx, 1046, t,        0.12, 0.30)
    tone(ctx, 1175, t + 0.15, 0.12, 0.30)
    tone(ctx, 1318, t + 0.30, 0.22, 0.35)
  } catch (_) {}
}
