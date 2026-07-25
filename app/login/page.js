'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../../lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState('login')

  async function handleGoogle() {
    setGoogleLoading(true)
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/` }
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    let result
    if (mode === 'signup') {
      result = await supabase.auth.signUp({ email, password })
      if (!result.error) {
        setError('Account created! You can now log in.')
        setMode('login')
        setLoading(false)
        return
      }
    } else {
      result = await supabase.auth.signInWithPassword({ email, password })
    }
    if (result.error) {
      setError(result.error.message)
      setLoading(false)
    } else {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#fafaf8' }}>
      <div className="w-full max-w-sm px-8">
        <div className="text-center mb-8">
          <h1 className="font-display text-4xl font-medium italic mb-1">Ledger</h1>
          <p className="text-xs text-gray-400 tracking-widest uppercase">the portfolio ledger</p>
        </div>

        {/* Google Sign In */}
        <button onClick={handleGoogle} disabled={googleLoading}
          className="w-full flex items-center justify-center gap-3 py-2.5 px-4 mb-4 rounded text-sm font-medium"
          style={{ background: 'white', border: '1px solid #e0e0d8', cursor: 'pointer', width: '100%' }}>
          <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
            <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
          </svg>
          {googleLoading ? 'Redirecting…' : 'Continue with Google'}
        </button>

        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 border-t border-gray-200" />
          <span className="text-xs text-gray-400">or</span>
          <div className="flex-1 border-t border-gray-200" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1 uppercase tracking-wider">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
          </div>
          {error && (
            <div className={`text-xs px-3 py-2 rounded ${error.includes('created') ? 'text-green-700 bg-green-50' : 'text-red-600 bg-red-50'}`}>{error}</div>
          )}
          <button type="submit" disabled={loading} className="btn-primary" style={{ display: 'block', width: '100%', textAlign: 'center' }}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          {mode === 'login' ? (
            <>First time?{' '}
              <button onClick={() => setMode('signup')} className="underline text-gray-600" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Create an account</button>
            </>
          ) : (
            <>Already have one?{' '}
              <button onClick={() => setMode('login')} className="underline text-gray-600" style={{ background: 'none', border: 'none', cursor: 'pointer' }}>Sign in</button>
            </>
          )}
        </p>
      </div>
    </div>
  )
}
